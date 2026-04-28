# Async Data

50,000 rows from a simulated server. The grid mounts with placeholder rows and fetches the visible window on every scroll.

**Run locally**

```bash
pnpm --filter @gridsmith/example-async-data dev
```

**Source** — [`examples/async-data/src/main.tsx`](https://github.com/retemper/gridsmith/blob/main/examples/async-data/src/main.tsx)

<<< @/../../examples/async-data/src/main.tsx

## What it shows

- `createAsyncDataPlugin({ source, pageSize: 100 })`.
- An `AsyncDataSource` with `getRows` and `getRowCount` that respect the `AbortSignal` parameter.
- Page-keyed dedupe — overlapping requests coalesce.
- A CSS shimmer on `.gs-cell--loading` for not-yet-arrived rows.

## Connect to your server

Replace `createMockSource` with real `fetch` calls:

```ts
const source: AsyncDataSource = {
  getRowCount: ({ signal } = {}) =>
    fetch('/api/rows/count', { signal })
      .then((r) => r.json())
      .then((j) => j.total),
  getRows: ({ start, end, sort, signal }) =>
    fetch(`/api/rows?start=${start}&end=${end}&sort=${encodeSort(sort)}`, { signal }).then((r) =>
      r.json(),
    ),
};
```

See [Async Data guide](/guides/async-data) for sort / filter propagation, error handling, and the full plugin API.
