import { PLACEHOLDER_ROW, type PlaceholderMeta } from './row-meta';
import type {
  AsyncDataPluginApi,
  AsyncDataPluginOptions,
  CellDecoration,
  GridPlugin,
  HistoryPluginApi,
  Row,
} from './types';

/**
 * Factory for placeholder rows. The `PLACEHOLDER_ROW` symbol survives
 * `grid.setData`'s spread copy (spread preserves symbol keys) and is what the
 * index map inspects to bypass client-side filters for not-yet-loaded rows.
 */
type PlaceholderRow = Row & PlaceholderMeta;

function makePlaceholder(): PlaceholderRow {
  const row: PlaceholderRow = {};
  row[PLACEHOLDER_ROW] = true;
  return row;
}

function makePlaceholders(count: number): Row[] {
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) rows[i] = makePlaceholder();
  return rows;
}

/**
 * Async data source plugin. Replaces the initial grid data with a dense array
 * of placeholder rows sized to the server-reported total, then fills windows
 * in place on demand via `api.loadRange(start, end)`.
 *
 * ## Caching & dedupe
 *
 * Fetches are rounded to `pageSize` boundaries so overlapping `loadRange`
 * requests coalesce into a single server call per page. A `pending` map keys
 * by page index; an in-flight fetch for a page is returned to duplicate
 * callers instead of being re-issued.
 *
 * ## Sort / filter
 *
 * In the default `serverSide*` mode, the plugin watches `sort:change` and
 * `filter:change`, aborts any in-flight fetches, clears the cache, re-fetches
 * the row count (filter can change it), and resets to placeholders. The
 * viewport effect that drives `loadRange` will request the visible page
 * against the new sort/filter on the next scroll tick.
 *
 * Client-side sort (the index-map comparator path) still runs over the loaded
 * window. For typical monotonic orderings the server-side order and the
 * client-side comparator agree, so this is a no-op; when they don't, users
 * should either set `serverSideSort: false` and pre-sort on the server once,
 * or provide a matching `ColumnDef.comparator`.
 *
 * ## History integration
 *
 * If the `history` plugin is registered, cell population uses
 * `history.suppress(...)` so loaded rows never enter the undo stack. Sort/
 * filter-driven placeholder resets are kept outside `suppress` because those
 * *are* user-visible state changes the history plugin handles natively.
 */
export function createAsyncDataPlugin(options: AsyncDataPluginOptions): GridPlugin {
  const { source, pageSize = 100, serverSideSort = true, serverSideFilter = true } = options;

  if (pageSize <= 0 || !Number.isFinite(pageSize)) {
    throw new Error(`[async-data] pageSize must be a positive finite number, got ${pageSize}`);
  }

  const plugin: GridPlugin = {
    name: 'async-data',

    init(ctx) {
      const grid = ctx.grid;
      const events = ctx.events;

      const loaded = new Set<number>();
      // Keyed by page index (floor(start / pageSize)). Value is the in-flight
      // fetch promise so concurrent callers get the same pending work.
      const pending = new Map<number, Promise<void>>();
      // Tracks AbortControllers per page so a cache invalidation (sort/filter
      // change, refresh) can cancel everything that was mid-flight.
      const aborters = new Map<number, AbortController>();

      let totalCount = 0;
      let inFlight = 0;
      // Generation counter bumped on every invalidation. Stale fetches that
      // resolve after their generation has been superseded drop their writes.
      let generation = 0;
      let destroyed = false;
      // Single in-flight count request. Tracked separately from page aborters
      // because there's never more than one live count fetch at a time — each
      // new call supersedes the previous.
      let countAborter: AbortController | null = null;

      const history = grid.getPlugin<HistoryPluginApi>('history');
      // When history isn't installed we still want to call the same code path,
      // so provide a transparent passthrough. History IS optional — the plugin
      // doesn't declare it as a dependency.
      const runQuiet = <T>(fn: () => T): T => (history ? history.suppress(fn) : fn());

      const abortAll = (): void => {
        for (const controller of aborters.values()) {
          controller.abort();
        }
        aborters.clear();
        pending.clear();
        countAborter?.abort();
        countAborter = null;
      };

      /**
       * Replace `grid.data` with a fresh array of `count` placeholders and
       * reset the loaded set. Fires `data:rowsUpdate` via `setData` — callers
       * that care about history should note this clears the undo stack.
       */
      const resetToPlaceholders = (count: number): void => {
        loaded.clear();
        totalCount = count;
        grid.setData(makePlaceholders(count));
      };

      const fetchCount = async (): Promise<number> => {
        countAborter?.abort();
        const controller = new AbortController();
        countAborter = controller;
        try {
          return await source.getRowCount({
            sort: serverSideSort ? grid.sortState.peek() : undefined,
            filter: serverSideFilter ? grid.filterState.peek() : undefined,
            signal: controller.signal,
          });
        } finally {
          if (countAborter === controller) countAborter = null;
        }
      };

      /**
       * Initial bootstrap: fetch the row count, seed placeholders, emit ready.
       * Separate from `loadPage` because `getRowCount` has its own shape and
       * because the event sequence (`asyncData:ready` once) differs from the
       * per-page `asyncData:loaded`.
       */
      const bootstrap = async (): Promise<void> => {
        const myGen = ++generation;
        try {
          const count = await fetchCount();
          if (destroyed || myGen !== generation) return;
          resetToPlaceholders(count);
          events.emit('asyncData:ready', { totalCount: count });
        } catch (err) {
          if (destroyed || myGen !== generation) return;
          if (isAbortError(err)) return;
          events.emit('asyncData:error', { error: toError(err) });
        }
      };

      const loadPage = (pageIndex: number): Promise<void> => {
        const existing = pending.get(pageIndex);
        if (existing) return existing;

        const pageStart = pageIndex * pageSize;
        const pageEnd = Math.min(pageStart + pageSize, totalCount);
        // Caller guarantees the page is in-range; belt-and-braces check below.
        if (pageStart >= totalCount) return Promise.resolve();

        const abortController = new AbortController();
        aborters.set(pageIndex, abortController);

        const myGen = generation;
        inFlight++;
        events.emit('asyncData:loading', { start: pageStart, end: pageEnd });

        const promise = (async () => {
          try {
            const rows = await source.getRows({
              start: pageStart,
              end: pageEnd,
              sort: serverSideSort ? grid.sortState.peek() : undefined,
              filter: serverSideFilter ? grid.filterState.peek() : undefined,
              signal: abortController.signal,
            });

            if (destroyed || myGen !== generation) return;

            const len = Math.min(rows.length, pageEnd - pageStart);
            // Wrap writes in `history.suppress` so the populated cells don't
            // land on the undo stack. `batchUpdate` coalesces the flurry of
            // `data:change` events so downstream listeners (React re-render,
            // validation) see a single transaction boundary per page.
            runQuiet(() => {
              grid.batchUpdate(() => {
                for (let i = 0; i < len; i++) {
                  const dataIdx = pageStart + i;
                  const row = rows[i];
                  if (!row) continue;
                  for (const key of Object.keys(row)) {
                    grid.setCellByDataIndex(dataIdx, key, row[key]);
                  }
                  loaded.add(dataIdx);
                }
              });
            });

            events.emit('asyncData:loaded', {
              start: pageStart,
              end: pageStart + len,
              totalCount,
            });
          } catch (err) {
            if (destroyed || myGen !== generation) return;
            // AbortError fires when the fetch is cancelled via invalidate —
            // that's an expected path, not something to surface as a user
            // error. Only real failures emit `asyncData:error`.
            if (isAbortError(err)) return;
            events.emit('asyncData:error', {
              error: toError(err),
              start: pageStart,
              end: pageEnd,
            });
          } finally {
            inFlight--;
            pending.delete(pageIndex);
            aborters.delete(pageIndex);
          }
        })();

        pending.set(pageIndex, promise);
        return promise;
      };

      // ─── API ──────────────────────────────────────────

      const api: AsyncDataPluginApi = {
        async loadRange(start, endInclusive) {
          if (totalCount === 0) return;
          if (endInclusive < start) return;

          // Translate view indices to data indices before paging, so a page
          // spans the *underlying* rows the server knows about. Under
          // client-side sort this means a single visible range may pull
          // multiple non-contiguous data pages — deliberate; we prefer to
          // keep server pagination aligned to the real dataset.
          const indexMap = grid.indexMap.get();
          const clampedStart = Math.max(0, start);
          const clampedEnd = Math.min(indexMap.length - 1, endInclusive);
          if (clampedStart > clampedEnd) return;

          const pageSet = new Set<number>();
          for (let view = clampedStart; view <= clampedEnd; view++) {
            const dataIdx = indexMap.viewToData(view);
            if (loaded.has(dataIdx)) continue;
            pageSet.add(Math.floor(dataIdx / pageSize));
          }

          const promises: Promise<void>[] = [];
          for (const page of pageSet) {
            const pageStart = page * pageSize;
            if (pageStart >= totalCount) continue;
            promises.push(loadPage(page));
          }
          await Promise.all(promises);
        },

        async refresh() {
          abortAll();
          await bootstrap();
        },

        getTotalCount() {
          return totalCount;
        },

        isRowLoaded(dataIndex) {
          return loaded.has(dataIndex);
        },

        isLoading() {
          return inFlight > 0;
        },
      };

      ctx.expose('async-data', api);

      // ─── Decorator: placeholder cells ────────────────

      ctx.addCellDecorator(({ row: viewIndex }): CellDecoration | null => {
        const indexMap = grid.indexMap.get();
        if (viewIndex < 0 || viewIndex >= indexMap.length) return null;
        const dataIdx = indexMap.viewToData(viewIndex);
        if (loaded.has(dataIdx)) return null;
        return {
          className: 'gs-cell--loading',
          attributes: { 'data-loading': 'true' },
        };
      });

      // ─── Invalidation on sort / filter ───────────────

      const onInvalidate = (kind: 'sort' | 'filter'): void => {
        // Bump generation first so any in-flight resolve drops its write,
        // then cancel HTTP work so the server can stop early.
        generation++;
        abortAll();

        if (kind === 'filter') {
          // Filter changes the row set — refetch count and reseed. Capture
          // the generation so a slow fetch from this filter can't overwrite
          // state once a newer filter has come in and bumped generation.
          const myGen = generation;
          void (async () => {
            try {
              const count = await fetchCount();
              if (destroyed || myGen !== generation) return;
              resetToPlaceholders(count);
            } catch (err) {
              if (destroyed || myGen !== generation) return;
              if (isAbortError(err)) return;
              events.emit('asyncData:error', { error: toError(err) });
            }
          })();
          return;
        }

        // Sort change: row count is unchanged, so we only need to reset
        // placeholders so stale loaded values don't flash in the new order.
        resetToPlaceholders(totalCount);
      };

      const unsubSort = serverSideSort
        ? events.on('sort:change', () => onInvalidate('sort'))
        : () => {};
      const unsubFilter = serverSideFilter
        ? events.on('filter:change', () => onInvalidate('filter'))
        : () => {};

      // Kick off initial load. Deferred to a microtask so consumers that
      // subscribe to `asyncData:ready` right after `createGrid` still catch
      // the event — listeners added within the `plugin:ready` callback for
      // this plugin are installed before the microtask runs.
      void bootstrap();

      return () => {
        destroyed = true;
        generation++;
        abortAll();
        loaded.clear();
        unsubSort();
        unsubFilter();
      };
    },
  };

  return plugin;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

export type {
  AsyncDataPluginApi,
  AsyncDataPluginOptions,
  AsyncDataSource,
  AsyncDataSourceCountParams,
  AsyncDataSourceParams,
} from './types';
