# Fill Handle

Drag the small dot at the bottom-right of the selection to extend a range. Gridsmith infers a pattern from the source values and extrapolates.

## Patterns recognized

| Pattern       | Examples                                         |
| ------------- | ------------------------------------------------ |
| Arithmetic    | `1, 2, 3 → 4, 5, 6` · `0.5, 1.0, 1.5 → 2.0, 2.5` |
| Date          | `2024-01-01, 2024-01-02 → 2024-01-03`            |
| Day of week   | `Mon, Tue → Wed, Thu` · `Monday → Tuesday`       |
| Month name    | `Jan, Feb → Mar` · `January → February`          |
| Prefix-number | `Q1, Q2 → Q3` · `item-7, item-8 → item-9`        |
| Custom list   | a list registered via `registerCustomList`       |
| Copy          | single value → repeat                            |

A single-cell drag of `Mon` or `January` extrapolates as the matching list, mirroring Excel.

## Direction

The handle picks the dominant axis of the drag:

- Vertical drag (up / down) → extends along rows
- Horizontal drag (left / right) → extends along columns

Excel only extrapolates along **one** axis at a time. Two-axis target ranges are rejected.

## Custom lists

Pre-register at plugin construction time:

```tsx
import { Grid, createFillHandlePlugin } from '@gridsmith/react';

<Grid
  data={data}
  columns={columns}
  plugins={[
    createFillHandlePlugin({
      customLists: [
        ['Bronze', 'Silver', 'Gold', 'Platinum'],
        ['Spring', 'Summer', 'Fall', 'Winter'],
      ],
    }),
  ]}
/>;
```

In headless mode (using `useGrid`), you can also call `fill.registerCustomList(...)` at runtime via the plugin API.

Built-in day and month lists are always active — your lists are added on top.

## Programmatic fill

```ts
const fill = grid.getPlugin<FillHandlePluginApi>('fill-handle');

// Returns boolean — false for degenerate inputs (empty source, target not
// containing source, two-axis extension).
fill.fill({
  source: { startRow: 0, endRow: 0, startCol: 'a', endCol: 'c' },
  target: { startRow: 0, endRow: 9, startCol: 'a', endCol: 'c' },
});
```

Constraints:

- `target` must strictly enclose `source`.
- One axis of extension only (height **or** width grows, not both).
- Cells in `editable: false` columns are skipped.

## Undo

A fill is one undoable step. The plugin wraps its writes in `grid.batchUpdate`, which the [history](./undo-redo) plugin records as a single transaction.

## Visuals

While dragging, a dashed preview rectangle shows the pending target. On release, the target becomes the new selection — same as Excel.

## Disabling

The default plugin set is hard-wired in `<Grid />`; opting out requires switching to **headless mode** with `useGrid` + `createRenderer`, where you control the plugin list:

```tsx
import { useGrid } from '@gridsmith/react';
import { createRenderer, createSelectionPlugin, createEditingPlugin } from '@gridsmith/core';

const grid = useGrid({
  data,
  columns,
  plugins: [createSelectionPlugin(), createEditingPlugin()],
});
// …mount with createRenderer.
```

`createSelectionPlugin` and `createEditingPlugin` are not re-exported from `@gridsmith/react` — import them from `@gridsmith/core`.

## Related

- [Selection](./selection) — the source range.
- [Undo / Redo](./undo-redo) — fills are reversible.
- [Validation](./validation) — filled cells run through validators.
