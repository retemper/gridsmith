# @gridsmith/benchmark

Public 1M-row benchmark site comparing Gridsmith vs AG Grid Community, Handsontable, and Glide Data Grid.

## Metrics

- **Render** — time from mount to first paint (ms)
- **Scroll FPS** — 120 frames of programmatic scroll via requestAnimationFrame
- **Edit latency** — `setDataAtCell`-equivalent API → paint (ms)
- **Memory** — `performance.memory.usedJSHeapSize` delta (MB, Chromium only)
- **Bundle** — library size after esbuild bundle + gzip, with `react`/`react-dom` externalized (KB)

## Targets (Gridsmith)

- < 100ms render
- ≥ 60fps scroll
- < 40KB gzip bundle

## Running

```bash
# From repo root
pnpm install
pnpm --filter @gridsmith/benchmark bundle-sizes   # writes public/bundle-sizes.json
pnpm --filter @gridsmith/benchmark dev             # start dev server
```

Open the dev server URL, pick a row count (10k / 100k / 1M), click **Run all**.

Bundle sizes are loaded from `public/bundle-sizes.json` at runtime — regenerate when dependencies change.

## Deploying

```bash
pnpm --filter @gridsmith/benchmark build
# serve apps/benchmark/dist/
```

## Notes

- **Always use the production build for real numbers** — `pnpm --filter @gridsmith/benchmark build && pnpm --filter @gridsmith/benchmark preview`. Dev mode (`pnpm dev`) ships unminified code and has React development warnings that skew render timings.
- Run in an empty Chrome tab with other tabs closed for stable numbers
- `performance.memory` is Chromium-only; Firefox/Safari report `—`
- Handsontable uses the `non-commercial-and-evaluation` license key
- Glide Data Grid uses its `getCellContent` callback API — it does not materialize all cells on mount, so its render time reflects viewport-only work
