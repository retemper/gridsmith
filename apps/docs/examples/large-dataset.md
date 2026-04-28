# Large Dataset

100,000 client-side rows rendered with row + column virtualization.

**Run locally**

```bash
pnpm --filter @gridsmith/example-large-dataset dev
```

**Source** — [`examples/large-dataset/src/main.tsx`](https://github.com/retemper/gridsmith/blob/main/examples/large-dataset/src/main.tsx)

<<< @/../../examples/large-dataset/src/main.tsx

## What it shows

- 100,000 rows × 8 columns kept in memory.
- Row pooling — only the visible rows + overscan exist in the DOM.
- Column virtualization with binary search for variable-width columns.
- Sort, filter, edit, paste — all stay at 60 fps.

## Tips for million-row grids

For datasets that don't fit in memory comfortably, switch to [Async Data](./async) — placeholder rows + on-demand fetching scale to tens of millions.

## Benchmark

The `apps/benchmark` site compares Gridsmith against AG Grid, Handsontable, and Glide on a 1M-row dataset. Run it with:

```bash
pnpm --filter @gridsmith/benchmark dev
```
