# Group Headers

Multi-level header groups. Define a `children` tree on a column to render a header that spans its leaves.

## Basic example

```ts
const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60 },
  {
    id: 'name_group',
    header: 'Name',
    children: [
      { id: 'first', header: 'First', width: 120 },
      { id: 'last', header: 'Last', width: 120 },
    ],
  },
  {
    id: 'address',
    header: 'Address',
    children: [
      { id: 'city', header: 'City', width: 120 },
      { id: 'country', header: 'Country', width: 120 },
    ],
  },
];
```

The grid renders two header rows: a top row with `Name` (spanning `First`/`Last`) and `Address` (spanning `City`/`Country`), and a leaf row with the four leaf columns.

## How it works

- The original tree is exposed on `grid.columnDefs`.
- The flat leaf list is exposed on `grid.columns` (always 1-D).
- All data operations (sort, filter, edit, selection) operate on **leaves only**.

## Helpers

```ts
import {
  flattenColumns,
  getHeaderDepth,
  buildHeaderRows,
  setLeafWidth,
  columnStructureKey,
} from '@gridsmith/core';

flattenColumns(tree); // ColumnDef[]   leaves only
getHeaderDepth(tree); // number — 1 means flat
buildHeaderRows(tree); // grid header rows for renderers
setLeafWidth(tree, 'first', 200); // immutable update
columnStructureKey(tree); // structural signature string
```

## Events

When the tree changes (resize / reorder), the grid emits:

- `columnDefs:update` — original tree changed
- `columns:update` — flat leaves changed structure (not for width-only resizes)

`resizeColumn` only fires `columnDefs:update` + `column:resize` for width-only changes.

## Limitations

- **Cross-group reorder** is currently a no-op. Moving a leaf out of its group (e.g. dragging `First` out of `Name` into `Address`) emits a warning and does nothing. This is deferred to Phase 2.
- All other operations (sort by leaf, filter, paste into leaf cells, fill, etc.) work normally.

## Related

- [Columns](./columns) — flat column features.
