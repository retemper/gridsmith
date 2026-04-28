# Selection

The selection plugin tracks one or more rectangular ranges plus a single active cell. It's auto-registered by `<Grid />`.

## State shape

```ts
interface SelectionState {
  readonly ranges: readonly CellRange[]; // every disjoint selected rectangle
  readonly activeCell: Readonly<CellCoord> | null; // focused / "anchor" cell
}

interface CellRange {
  startRow: number;
  endRow: number;
  startCol: string; // column id
  endCol: string; // column id
}

interface CellCoord {
  row: number; // view-row index
  col: string; // column id
}
```

`row` is a **view** index (after sort / filter); `col` is the column **id** (the `id` field on your `ColumnDef`), not a numeric index.

## Mouse parity (Excel / Google Sheets)

| Gesture                   | Behavior                                |
| ------------------------- | --------------------------------------- |
| Click cell                | Single-cell selection; sets active cell |
| Click + drag              | Extend a range                          |
| Shift + click             | Extend the active range                 |
| Ctrl / Cmd + click        | Add a disjoint single-cell range        |
| Click header label        | Select the entire column                |
| Ctrl / Cmd + click header | Add the column to selection             |

## Keyboard parity

| Keys              | Behavior                    |
| ----------------- | --------------------------- |
| Arrow keys        | Move the active cell        |
| `Shift + Arrow`   | Extend the active range     |
| `Ctrl/Cmd + A`    | Select all                  |
| `Shift + Space`   | Select the active row       |
| `Ctrl + Space`    | Select the active column    |
| `Esc`             | Clear the current selection |
| `Home` / `End`    | Jump to row start / end     |
| `Ctrl + Home/End` | Jump to grid corner         |

## Reading selection in React

`useGridSelection(grid)` is for [headless setups](/api/react#headless-mode) where you create the grid yourself via `useGrid`. With the `<Grid />` component, listen on the event bus directly using a callback ref:

```tsx
import { Grid, type SelectionState } from '@gridsmith/react';
// In headless mode:
import { useGrid, useGridSelection } from '@gridsmith/react';

function HeadlessExample() {
  const grid = useGrid({ data, columns });
  const { ranges, activeCell } = useGridSelection(grid);
  // …mount with createRenderer or render your own.
  return <p>Active: {activeCell ? `${activeCell.row},${activeCell.col}` : 'none'}</p>;
}
```

## Programmatic selection

```ts
const selection = grid.getPlugin<SelectionPluginApi>('selection');

selection.selectCell({ row: 0, col: 'name' });
selection.extendTo({ row: 4, col: 'price' }); // grow the active range to here
selection.addCell({ row: 6, col: 'name' }); // disjoint single-cell range
selection.selectRow(3); // view-row index
selection.selectColumn('price'); // column id
selection.selectAll();
selection.clear();

selection.isCellSelected(2, 'price'); // (rowIndex, columnId)
selection.isCellActive(2, 'price');
```

`selectRow` and `selectColumn` accept an optional `mode: 'replace' | 'add' | 'extend'` (default `'replace'`).

`addCell` is a toggle — calling it again on the same isolated single-cell range removes it (Ctrl/Cmd-click parity).

## Listening to changes

```ts
grid.events.on('selection:change', (state) => {
  // state: SelectionState (defensive copy)
});
```

## Auto-clear

Selection clears automatically on:

- `sort:change`
- `filter:change`
- `data:rowsUpdate`
- `columns:update`
- `grid.destroy()`

This avoids stale view indices after the underlying view shifts.

## CSS hooks

Cells inside any range get `gs-cell--selected`. The active cell gets `gs-cell--active` (alias `gs-cell--focused`) plus `aria-selected="true"`.

## Related

- [Clipboard](./clipboard) — copies the active range.
- [Fill Handle](./fill-handle) — extends the active range.
- [Keyboard Navigation](./keyboard-navigation) — full key map.
