// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAsyncDataPlugin } from './async-data';
import { createGrid } from './grid';
import { createHistoryPlugin } from './history';
import type {
  AsyncDataPluginApi,
  AsyncDataSource,
  AsyncDataSourceCountParams,
  AsyncDataSourceParams,
  ColumnDef,
  GridEvents,
  HistoryPluginApi,
  Row,
} from './types';

const columns: ColumnDef[] = [
  { id: 'a', header: 'A', type: 'text' },
  { id: 'b', header: 'B', type: 'number' },
];

/**
 * Generate a deterministic dataset row at the given index. Keeps the fake
 * server implementations short and lets assertions check values by position.
 */
function rowAt(i: number): Row {
  return { a: `row-${i}`, b: i };
}

interface FakeSourceOptions {
  total: number;
  delay?: number;
  onGetRows?: (params: AsyncDataSourceParams) => void;
  onGetCount?: (params?: AsyncDataSourceCountParams) => void;
}

function makeFakeSource(opts: FakeSourceOptions): AsyncDataSource & { calls: number } {
  const state = {
    calls: 0,
    getRows(params: AsyncDataSourceParams) {
      state.calls++;
      opts.onGetRows?.(params);
      const rows: Row[] = [];
      for (let i = params.start; i < params.end && i < opts.total; i++) {
        rows.push(rowAt(i));
      }
      if (opts.delay && opts.delay > 0) {
        return new Promise<readonly Row[]>((resolve, reject) => {
          const t = setTimeout(() => resolve(rows), opts.delay);
          params.signal?.addEventListener('abort', () => {
            clearTimeout(t);
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
      return Promise.resolve<readonly Row[]>(rows);
    },
    getRowCount(params?: AsyncDataSourceCountParams) {
      opts.onGetCount?.(params);
      return Promise.resolve(opts.total);
    },
  };
  return state;
}

async function flushMicrotasks(): Promise<void> {
  // Two ticks: one for the bootstrap promise chain, one for the listener
  // follow-ups that emit events.
  await Promise.resolve();
  await Promise.resolve();
}

describe('async data plugin', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('bootstrap', () => {
    it('fetches row count and seeds placeholders', async () => {
      const source = makeFakeSource({ total: 250 });
      const readySpy = vi.fn();
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source })],
      });
      grid.events.on('asyncData:ready', readySpy);

      await flushMicrotasks();

      expect(grid.rowCount).toBe(250);
      expect(readySpy).toHaveBeenCalledTimes(1);
      expect(readySpy).toHaveBeenCalledWith({ totalCount: 250 });
      // No rows loaded yet — every cell is a placeholder.
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      expect(api.isRowLoaded(0)).toBe(false);
      expect(api.getTotalCount()).toBe(250);
    });

    it('emits asyncData:error when getRowCount rejects', async () => {
      const source: AsyncDataSource = {
        getRows: () => Promise.resolve([]),
        getRowCount: () => Promise.reject(new Error('boom')),
      };
      const errorSpy = vi.fn();
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source })],
      });
      grid.events.on('asyncData:error', errorSpy);

      await flushMicrotasks();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0].error.message).toBe('boom');
    });
  });

  describe('loadRange', () => {
    it('fetches pages overlapping the range and populates cells', async () => {
      const source = makeFakeSource({ total: 500 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      const loadedSpy = vi.fn<(payload: GridEvents['asyncData:loaded']) => void>();
      grid.events.on('asyncData:loaded', loadedSpy);

      await api.loadRange(0, 149);

      // Expect two pages fetched: [0,100) and [100,200).
      expect(source.calls).toBe(2);
      expect(loadedSpy).toHaveBeenCalledTimes(2);
      expect(grid.getCell(0, 'a')).toBe('row-0');
      expect(grid.getCell(149, 'b')).toBe(149);
      expect(api.isRowLoaded(0)).toBe(true);
      expect(api.isRowLoaded(99)).toBe(true);
      expect(api.isRowLoaded(200)).toBe(false);
    });

    it('deduplicates concurrent loadRange calls', async () => {
      const source = makeFakeSource({ total: 200, delay: 20 });
      vi.useFakeTimers();
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      // bootstrap
      await vi.advanceTimersByTimeAsync(0);

      const p1 = api.loadRange(0, 50);
      const p2 = api.loadRange(10, 90);
      const p3 = api.loadRange(0, 99);

      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([p1, p2, p3]);

      // Only one server call despite three overlapping loads of the same page.
      expect(source.calls).toBe(1);
    });

    it('skips pages that are already fully loaded', async () => {
      const source = makeFakeSource({ total: 200 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      await api.loadRange(0, 99);
      expect(source.calls).toBe(1);

      await api.loadRange(0, 99);
      // No additional fetch — page was cached.
      expect(source.calls).toBe(1);
    });

    it('marks placeholder cells via decorator', async () => {
      const source = makeFakeSource({ total: 100 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      const before = grid.getCellDecorations(0, 'a');
      expect(before.some((d) => d.className === 'gs-cell--loading')).toBe(true);

      await api.loadRange(0, 49);

      const after = grid.getCellDecorations(0, 'a');
      expect(after.some((d) => d.className === 'gs-cell--loading')).toBe(false);
    });
  });

  describe('server-side sort/filter delegation', () => {
    it('forwards sort state to getRows', async () => {
      const seenSorts: (AsyncDataSourceParams['sort'] | undefined)[] = [];
      const source = makeFakeSource({
        total: 100,
        onGetRows: (p) => seenSorts.push(p.sort),
      });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      grid.sortState.set([{ columnId: 'b', direction: 'desc' }]);
      await flushMicrotasks();
      await api.loadRange(0, 49);

      const last = seenSorts[seenSorts.length - 1];
      expect(last).toEqual([{ columnId: 'b', direction: 'desc' }]);
    });

    it('invalidates cache on sort change', async () => {
      const source = makeFakeSource({ total: 200 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      await api.loadRange(0, 99);
      expect(api.isRowLoaded(0)).toBe(true);

      grid.sortState.set([{ columnId: 'a', direction: 'asc' }]);
      // After invalidation, rows are reset to placeholders.
      expect(api.isRowLoaded(0)).toBe(false);

      await api.loadRange(0, 99);
      // Second call refetches (plus the original), so source saw at least 2 page loads.
      expect(source.calls).toBeGreaterThanOrEqual(2);
    });

    it('refetches row count on filter change', async () => {
      let total = 200;
      let countCalls = 0;
      const source: AsyncDataSource = {
        getRows: () => Promise.resolve([]),
        getRowCount: () => {
          countCalls++;
          return Promise.resolve(total);
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      await flushMicrotasks();
      expect(countCalls).toBe(1);
      expect(grid.rowCount).toBe(200);

      total = 50;
      grid.filterState.set([{ columnId: 'a', operator: 'contains', value: 'x' }]);
      await flushMicrotasks();

      expect(countCalls).toBe(2);
      expect(grid.rowCount).toBe(50);
    });

    it('ignores stale row count when filter changes rapidly', async () => {
      // Filter A → slow count (300ms). Filter B fires before A resolves →
      // fast count (10ms). The final rowCount must reflect filter B, not
      // the stale count from filter A.
      vi.useFakeTimers();

      let call = 0;
      const source: AsyncDataSource = {
        getRows: () => Promise.resolve([]),
        getRowCount: (params) => {
          call++;
          const thisCall = call;
          const delay = thisCall === 1 ? 0 : thisCall === 2 ? 300 : 10;
          const result = thisCall === 2 ? 500 : 42;
          return new Promise<number>((resolve, reject) => {
            const t = setTimeout(() => resolve(result), delay);
            params?.signal?.addEventListener('abort', () => {
              clearTimeout(t);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 100 })],
      });
      await vi.advanceTimersByTimeAsync(0);

      // Filter A kicks off slow count (would resolve to 500 at +300ms).
      grid.filterState.set([{ columnId: 'a', operator: 'contains', value: 'a' }]);
      await vi.advanceTimersByTimeAsync(50);

      // Filter B replaces A before A resolves. B's count is fast (10ms) → 42.
      grid.filterState.set([{ columnId: 'a', operator: 'contains', value: 'b' }]);
      await vi.advanceTimersByTimeAsync(500);

      expect(grid.rowCount).toBe(42);
    });
  });

  describe('history integration', () => {
    it('does not record loaded rows on the undo stack', async () => {
      const source = makeFakeSource({ total: 100 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createHistoryPlugin(), createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      const history = grid.getPlugin<HistoryPluginApi>('history')!;
      await flushMicrotasks();

      await api.loadRange(0, 49);

      // After the async load the undo stack must still be empty; otherwise
      // the user would see "undo" reverse a passive scroll into loaded rows.
      expect(history.canUndo()).toBe(false);

      // A real user edit on a loaded cell must still be undoable — suppression
      // is scoped, not global.
      grid.setCell(0, 'a', 'edited');
      expect(history.canUndo()).toBe(true);
      expect(history.undo()).toBe(true);
      expect(grid.getCell(0, 'a')).toBe('row-0');
    });
  });

  describe('refresh', () => {
    it('clears cache and refetches', async () => {
      const source = makeFakeSource({ total: 100 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      await api.loadRange(0, 49);
      expect(api.isRowLoaded(0)).toBe(true);
      const callsBefore = source.calls;

      await api.refresh();
      expect(api.isRowLoaded(0)).toBe(false);

      await api.loadRange(0, 49);
      expect(source.calls).toBe(callsBefore + 1);
    });
  });

  describe('validation & edge cases', () => {
    it('throws when pageSize is not a positive finite number', () => {
      const source = makeFakeSource({ total: 0 });
      expect(() => createAsyncDataPlugin({ source, pageSize: 0 })).toThrow(/pageSize/);
      expect(() => createAsyncDataPlugin({ source, pageSize: -1 })).toThrow(/pageSize/);
      expect(() => createAsyncDataPlugin({ source, pageSize: Infinity })).toThrow(/pageSize/);
    });

    it('loadRange is a no-op when totalCount is 0 or range is inverted', async () => {
      const source = makeFakeSource({ total: 0 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      await api.loadRange(0, 10);
      await api.loadRange(10, 5); // inverted
      expect(source.calls).toBe(0);
    });

    it('isLoading reflects in-flight state', async () => {
      vi.useFakeTimers();
      const source = makeFakeSource({ total: 100, delay: 50 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await vi.advanceTimersByTimeAsync(0);

      expect(api.isLoading()).toBe(false);
      const p = api.loadRange(0, 49);
      expect(api.isLoading()).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      await p;
      expect(api.isLoading()).toBe(false);
    });

    it('wraps non-Error rejections into an Error on asyncData:error', async () => {
      const source: AsyncDataSource = {
        getRows: () => Promise.resolve([]),
        getRowCount: () => Promise.reject('string failure'),
      };
      const errorSpy = vi.fn();
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source })],
      });
      grid.events.on('asyncData:error', errorSpy);
      await flushMicrotasks();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0].error).toBeInstanceOf(Error);
      expect(errorSpy.mock.calls[0][0].error.message).toBe('string failure');
    });

    it('respects serverSideSort: false (sort events ignored)', async () => {
      const source = makeFakeSource({ total: 100 });
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50, serverSideSort: false })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();
      await api.loadRange(0, 49);
      expect(api.isRowLoaded(0)).toBe(true);

      grid.sortState.set([{ columnId: 'b', direction: 'asc' }]);
      // Cache not invalidated — row still loaded.
      expect(api.isRowLoaded(0)).toBe(true);
    });

    it('respects serverSideFilter: false (filter events ignored)', async () => {
      let countCalls = 0;
      const source: AsyncDataSource = {
        getRows: () => Promise.resolve([]),
        getRowCount: () => {
          countCalls++;
          return Promise.resolve(100);
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50, serverSideFilter: false })],
      });
      await flushMicrotasks();
      expect(countCalls).toBe(1);

      grid.filterState.set([{ columnId: 'a', operator: 'contains', value: 'x' }]);
      await flushMicrotasks();
      // Count not refetched — filter events are local-only.
      expect(countCalls).toBe(1);
    });

    it('tolerates short server responses (fewer rows than requested)', async () => {
      const source: AsyncDataSource = {
        getRowCount: () => Promise.resolve(100),
        // Return only 30 rows for a 50-row page request — last 20 slots stay placeholders.
        getRows: (p) => {
          const rows: Row[] = [];
          for (let i = p.start; i < p.start + 30 && i < p.end; i++) rows.push(rowAt(i));
          return Promise.resolve(rows);
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await flushMicrotasks();

      await api.loadRange(0, 49);
      expect(api.isRowLoaded(0)).toBe(true);
      expect(api.isRowLoaded(29)).toBe(true);
      expect(api.isRowLoaded(30)).toBe(false);
    });

    it('plugin destroy cancels in-flight fetches', async () => {
      vi.useFakeTimers();
      const abortedSignals: AbortSignal[] = [];
      const source: AsyncDataSource = {
        getRowCount: () => Promise.resolve(100),
        getRows: (params) => {
          if (params.signal) abortedSignals.push(params.signal);
          return new Promise<readonly Row[]>((resolve, reject) => {
            const t = setTimeout(() => resolve([]), 100);
            params.signal?.addEventListener('abort', () => {
              clearTimeout(t);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await vi.advanceTimersByTimeAsync(0);

      const p = api.loadRange(0, 49);
      grid.destroy();
      await vi.advanceTimersByTimeAsync(200);
      await p;

      expect(abortedSignals[0].aborted).toBe(true);
    });
  });

  describe('cancellation', () => {
    it('aborts in-flight fetches when sort invalidates', async () => {
      vi.useFakeTimers();
      const abortedSignals: AbortSignal[] = [];
      const source: AsyncDataSource = {
        getRowCount: () => Promise.resolve(100),
        getRows: (params) => {
          if (params.signal) abortedSignals.push(params.signal);
          return new Promise<readonly Row[]>((resolve, reject) => {
            const t = setTimeout(() => {
              const rows: Row[] = [];
              for (let i = params.start; i < params.end; i++) rows.push(rowAt(i));
              resolve(rows);
            }, 100);
            params.signal?.addEventListener('abort', () => {
              clearTimeout(t);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
        },
      };
      const grid = createGrid({
        data: [],
        columns,
        plugins: [createAsyncDataPlugin({ source, pageSize: 50 })],
      });
      const api = grid.getPlugin<AsyncDataPluginApi>('async-data')!;
      await vi.advanceTimersByTimeAsync(0);

      const p = api.loadRange(0, 49);
      // Before the fetch resolves, change sort — should abort.
      grid.sortState.set([{ columnId: 'a', direction: 'asc' }]);
      await vi.advanceTimersByTimeAsync(200);
      await p;

      expect(abortedSignals.length).toBeGreaterThan(0);
      expect(abortedSignals[0].aborted).toBe(true);
    });
  });
});
