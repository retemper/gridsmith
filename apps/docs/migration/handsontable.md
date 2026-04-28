# From Handsontable

Gridsmith is a spiritual successor to Handsontable: spreadsheet-grade editing in a permissively licensed package. This guide maps Handsontable's API to Gridsmith's and flags the parts that differ.

::: tip License
Gridsmith is **MIT, no Pro tier, ever**. Every feature on the Handsontable Pro / Enterprise tier is available in the same package.
:::

## Concept mapping

| Handsontable                 | Gridsmith                                          |
| ---------------------------- | -------------------------------------------------- |
| `new Handsontable(el, opts)` | `createGrid(opts)` + `createRenderer().mount(el)`  |
| `<HotTable />` (React)       | `<Grid />`                                         |
| `data: any[][]`              | `data: Row[]` (array of objects)                   |
| `colHeaders` / `columns`     | `columns: ColumnDef[]`                             |
| `cells(row, col, prop)`      | `cellRenderer` / `cellEditor` / per-column config  |
| `customBorders`              | (planned — open an issue if needed)                |
| `mergeCells`                 | not supported (deferred)                           |
| `formulas` plugin            | not supported (you can wire your own)              |
| `nestedHeaders` plugin       | `columns[].children` tree (built-in)               |
| `manualColumnResize`         | `resizable: true` (default)                        |
| `manualColumnMove`           | enabled by default; per-column opt-out             |
| `fixedColumnsLeft/Right`     | `pin: 'left' \| 'right'`                           |
| `fixedRowsTop/Bottom`        | `pinnedTopRows` / `pinnedBottomRows` (Grid prop)   |
| `comments` plugin            | not built-in (use cell renderer + overlay)         |
| `dropdownMenu`               | (planned)                                          |
| `filters` plugin             | built-in (per-column popover)                      |
| `columnSorting`              | built-in (header click)                            |
| `multiColumnSorting`         | built-in (`Shift+click` headers)                   |
| `undoRedo`                   | `createHistoryPlugin()` (auto-registered in React) |
| `copyPaste` plugin           | `createClipboardPlugin()` (auto-registered)        |
| `autoFill` plugin            | `createFillHandlePlugin()` (auto-registered)       |

## Data model

### Handsontable

```js
const hot = new Handsontable(container, {
  data: [
    ['Alice', 30],
    ['Bob', 25],
  ],
  colHeaders: ['Name', 'Age'],
});
```

Handsontable accepts either array-of-arrays **or** array-of-objects with `data` keys.

### Gridsmith

```ts
import { Grid } from '@gridsmith/react';

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

const columns = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age',  header: 'Age',  type: 'number' },
];

<Grid data={data} columns={columns} />;
```

Gridsmith uses **array-of-objects only**. If your Handsontable code uses array-of-arrays, convert to objects keyed by your column ids.

## Editors

| Handsontable           | Gridsmith                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `type: 'text'`         | `type: 'text'`                                               |
| `type: 'numeric'`      | `type: 'number'`                                             |
| `type: 'checkbox'`     | `type: 'checkbox'`                                           |
| `type: 'date'`         | `type: 'date'`                                               |
| `type: 'dropdown'`     | `type: 'select'` + `selectOptions`                           |
| `type: 'autocomplete'` | custom editor — see [Custom Editors](/guides/custom-editors) |
| `type: 'time'`         | custom editor                                                |
| `type: 'handsontable'` | not supported                                                |

```ts
// Handsontable
{ data: 'role', type: 'dropdown', source: ['Admin', 'Member'] }

// Gridsmith
{
  id: 'role',
  type: 'select',
  selectOptions: [
    { label: 'Admin',  value: 'admin'  },
    { label: 'Member', value: 'member' },
  ],
}
```

## Hooks → Events

| Handsontable hook       | Gridsmith event    | Notes               |
| ----------------------- | ------------------ | ------------------- |
| `afterChange`           | `data:change`      | per-cell payload    |
| `afterSelection`        | `selection:change` | range + active cell |
| `afterCopy`             | `clipboard:copy`   |                     |
| `afterCut`              | `clipboard:cut`    |                     |
| `afterPaste`            | `clipboard:paste`  |                     |
| `afterUndo`/`afterRedo` | `history:change`   |                     |
| `afterColumnResize`     | `column:resize`    |                     |
| `afterColumnMove`       | `column:reorder`   |                     |
| `afterFilter`           | `filter:change`    |                     |
| `afterColumnSort`       | `sort:change`      |                     |

```ts
// Handsontable
hot.addHook('afterChange', (changes) => save(changes));

// Gridsmith
grid.events.on('data:change', ({ changes }) => save(changes));
```

## Validation

Handsontable: `validator: (value, callback) => callback(true | false)`.

Gridsmith: `validate: (value, ctx) => true | string` (string is the error message). For async: `asyncValidate`.

```ts
// Handsontable
{ data: 'age', validator: (v, cb) => cb(typeof v === 'number' && v >= 0) }

// Gridsmith
{ id: 'age', validate: (v) => (typeof v === 'number' && v >= 0) || 'Must be ≥ 0' }
```

## Async data

Handsontable doesn't ship server-side virtualization; you load all rows upfront.

Gridsmith ships [Async Data](/guides/async-data):

```ts
createAsyncDataPlugin({
  source: {
    getRows: ({ start, end, signal }) => api.fetchRows(start, end, signal),
    getRowCount: () => api.fetchTotal(),
  },
  pageSize: 100,
});
```

## Programmatic API

| Handsontable                    | Gridsmith                                                   |
| ------------------------------- | ----------------------------------------------------------- |
| `hot.getData()`                 | `grid.data` (plain `readonly Row[]`)                        |
| `hot.getDataAtCell(r, c)`       | `grid.getCell(rowIndex, columnId)`                          |
| `hot.setDataAtCell(r, c, v)`    | `grid.setCell(rowIndex, columnId, v)`                       |
| `hot.setDataAtRowProp(r, p, v)` | `grid.setCell(rowIndex, columnId, v)`                       |
| `hot.batch(fn)`                 | `grid.batchUpdate(fn)`                                      |
| `hot.alter('insert_row', ...)`  | manage your row array directly (Gridsmith doesn't own data) |
| `hot.selectCell(r, c)`          | `selection.selectCell({ row: r, col: columnId })`           |
| `hot.deselectCell()`            | `selection.clear()`                                         |
| `hot.undo()` / `hot.redo()`     | `history.undo()` / `history.redo()` (return `boolean`)      |
| `hot.copyPaste.copy()`          | `clipboard.copy()` (returns `Promise<boolean>`)             |
| `hot.render()`                  | not needed — reactive, auto-renders                         |
| `hot.destroy()`                 | `grid.destroy()`                                            |

## Things Handsontable supports that Gridsmith does not (yet)

- **Cell merging** — no `mergeCells`.
- **Formulas** — no built-in HyperFormula integration.
- **Nested rows** / tree mode.
- **Master/detail** — no expandable row hierarchies.
- **Comments** — not built-in.
- **Custom borders** — planned.
- **Aggregations** — no sum/avg/count footer rows.

If any of these are blockers, [open an issue](https://github.com/retemper/gridsmith/issues) or contribute — Gridsmith is MIT and open to PRs.

## Things Gridsmith does that Handsontable Pro does

All of these are in the MIT package:

- Range selection (multi-range, row/column select)
- Excel-compatible clipboard (TSV + HTML)
- Drag-fill with pattern recognition
- Undo / redo
- Async data with infinite scroll
- Cell validation (sync + async)
- Multi-level header groups
- Column / row pinning
- Sort + filter (single & multi)

## Migration checklist

1. Convert array-of-arrays → array-of-objects.
2. Build a `ColumnDef[]` from your Handsontable column config.
3. Replace `Handsontable(container, opts)` / `<HotTable />` with `<Grid />` (or `createGrid` + `createRenderer`).
4. Move `addHook('afterChange', ...)` to `grid.events.on('data:change', ...)`.
5. Drop `hot.render()` — reactivity is built-in.
6. Replace `validator(callback)` with `validate(value) => true | string`.
7. If you used the autoFill plugin with custom lists, register them with `createFillHandlePlugin({ customLists })`.

## Need help?

[Open a discussion](https://github.com/retemper/gridsmith/discussions). Migration friction is something we want to fix — concrete reports help.
