---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add async data source + infinite scroll plugin.

**Core (`@gridsmith/core`):**

- New `createAsyncDataPlugin({ source, pageSize?, serverSideSort?, serverSideFilter? })`
  replaces `grid.data` with a dense array of placeholder rows sized
  to the server-reported total, then fills windows in place on demand
  via `api.loadRange(start, end)`.
- `AsyncDataSource` interface: `getRows({ start, end, sort?, filter?, signal? })`
  and `getRowCount({ sort?, filter?, signal? })`. Both receive an
  `AbortSignal` so cache invalidations (sort/filter change, `refresh()`)
  can cancel in-flight HTTP work.
- Page-keyed dedupe: overlapping `loadRange` calls coalesce into one
  server request per page; concurrent callers share the same promise.
- Generation counter drops stale writes if a fetch resolves after its
  invalidation, guaranteeing sort/filter transitions never paint old
  data on top of new.
- `'sort:change'` clears placeholders (row count unchanged); `'filter:change'`
  re-fetches the row count first, then reseeds. Both bypass the undo
  stack by design — sort/filter is already a user-visible state change
  the history plugin handles natively.
- Populated cells are written inside `history.suppress(...)` when the
  history plugin is registered, so loaded rows never enter the undo
  stack. `batchUpdate` coalesces the flurry of `data:change` events.
- Cell decorator adds `gs-cell--loading` and `data-loading="true"` to
  not-yet-loaded rows so adapters can render a skeleton.
- New events: `'asyncData:ready'`, `'asyncData:loading'`, `'asyncData:loaded'`,
  `'asyncData:error'`.
- New API: `loadRange`, `refresh`, `getTotalCount`, `isRowLoaded`, `isLoading`.
- New types: `AsyncDataSource`, `AsyncDataSourceParams`,
  `AsyncDataSourceCountParams`, `AsyncDataPluginOptions`,
  `AsyncDataPluginApi`.
- Placeholder rows carry a `PLACEHOLDER_ROW` symbol; the index map
  bypasses client-side filter predicates for those rows so they stay
  visible during a refetch.
- `HistoryPluginApi` adds `suppress<T>(fn: () => T): T` — a refcounted
  scope that tells history to ignore `data:change`/`selection:change`
  while plugins bulk-populate rows.

**React (`@gridsmith/react`):**

- Viewport effect calls `asyncData.loadRange(rowStart, rowEnd)` whenever
  the visible range or total row count moves, so scrolling fetches the
  next window automatically. Noop when the plugin isn't registered.
- Re-exports `createAsyncDataPlugin`, `AsyncDataSource`,
  `AsyncDataSourceParams`, `AsyncDataSourceCountParams`,
  `AsyncDataPluginOptions`, `AsyncDataPluginApi`.
