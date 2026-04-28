# Async Data

The `async-data` plugin replaces `grid.data` with a virtualized window of placeholder rows and fills them on demand from your data source. Combined with virtualization, this is how Gridsmith handles million-row tables.

## Plugin setup

```tsx
import { Grid, createAsyncDataPlugin, type AsyncDataSource } from '@gridsmith/react';

const source: AsyncDataSource = {
  async getRowCount({ filter, signal } = {}) {
    const res = await fetch('/api/rows/count', { signal });
    return (await res.json()).total;
  },

  async getRows({ start, end, sort, filter, signal }) {
    const res = await fetch(`/api/rows?start=${start}&end=${end}&sort=${encodeSort(sort)}`, {
      signal,
    });
    return res.json();
  },
};

<Grid data={[]} columns={columns} plugins={[createAsyncDataPlugin({ source, pageSize: 50 })]} />;
```

The grid mounts with the **server-reported total** of placeholder rows. Pages fill in as the user scrolls.

## Source contract

```ts
interface AsyncDataSource {
  getRowCount(params?: AsyncDataSourceCountParams): Promise<number>;
  getRows(params: AsyncDataSourceParams): Promise<Row[]>;
}

interface AsyncDataSourceParams {
  start: number; // inclusive view index
  end: number; // exclusive view index
  sort?: SortState;
  filter?: FilterState;
  signal?: AbortSignal;
}
```

Both methods receive an `AbortSignal`. Honor it — the plugin cancels in-flight requests when sort or filter changes.

## Plugin options

```ts
createAsyncDataPlugin({
  source,
  pageSize: 100,
  serverSideSort: true, // default false → client sorts loaded rows
  serverSideFilter: true, // default false → client filters loaded rows
});
```

If you set `serverSideSort: true`, sort changes invalidate the cache. If `false`, the plugin treats your data as a complete, sorted set per-page (rarely what you want for true server-side data).

## How it works

- `loadRange(start, end)` is called on every viewport change.
- Page-keyed dedupe: overlapping calls coalesce into one request per page; concurrent callers share the promise.
- A generation counter drops stale writes if a fetch resolves after its invalidation. Sort/filter transitions never paint old data on top of new.
- `'sort:change'` clears placeholders (row count unchanged); `'filter:change'` re-fetches the row count first, then reseeds.
- Loaded cells are written inside `history.suppress` so they don't enter the undo stack.

## Loading state

Not-yet-loaded rows carry `gs-cell--loading` and `data-loading="true"`. Render a skeleton with CSS:

```css
.gs-cell--loading {
  background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
  background-size: 200% 100%;
  animation: gs-shimmer 1.4s linear infinite;
  color: transparent;
}
```

## API

```ts
const async = grid.getPlugin<AsyncDataPluginApi>('async-data');

await async.loadRange(0, 200); // force-load a window
async.refresh(); // invalidate cache, re-fetch count + visible page
async.getTotalCount(); // current row count
async.isRowLoaded(idx); // boolean
async.isLoading(); // boolean
```

## Events

| Event               | Payload                      |
| ------------------- | ---------------------------- |
| `asyncData:ready`   | `{ totalCount }`             |
| `asyncData:loading` | `{ start, end }`             |
| `asyncData:loaded`  | `{ start, end, totalCount }` |
| `asyncData:error`   | `{ error, start?, end? }`    |

## Edits with async data

Edits work normally — the plugin doesn't change `setCell` semantics. Be aware that:

- Edits to **placeholder** rows aren't meaningful (the value will be overwritten by the next fetch).
- You should persist edits server-side in `onCellChange` and re-fetch the affected rows if needed.

## Related

- [Sort & Filter](./sort-filter) — how sort/filter state is propagated.
- [Change Tracking](./change-tracking) — for staged-commit workflows.
