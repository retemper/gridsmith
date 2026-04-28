# From AG Grid

If you're on AG Grid Community, the migration is mostly mechanical. If you're on AG Grid Enterprise, this guide also covers what's available in Gridsmith's MIT package.

::: tip License
Many AG Grid Enterprise features (range selection, fill handle, clipboard, master/detail, etc.) require a paid license. Gridsmith ships range selection, fill handle, clipboard, and undo/redo in the **MIT** package — no license key, no paywall.
:::

## Concept mapping

| AG Grid                          | Gridsmith                                            |
| -------------------------------- | ---------------------------------------------------- |
| `<AgGridReact />`                | `<Grid />`                                           |
| `rowData`                        | `data`                                               |
| `columnDefs`                     | `columns`                                            |
| `colDef.field`                   | `id`                                                 |
| `colDef.headerName`              | `header`                                             |
| `colDef.editable`                | `editable`                                           |
| `colDef.cellEditor`              | `cellEditor` (React adapter) or `editor` (string id) |
| `colDef.cellRenderer`            | `cellRenderer`                                       |
| `colDef.valueFormatter`          | implement in `cellRenderer`                          |
| `colDef.valueGetter`             | derive at the data layer                             |
| `colDef.pinned`                  | `pin: 'left' \| 'right'`                             |
| `colDef.sortable`                | `sortable`                                           |
| `colDef.filter`                  | `filterable: true` + per-column popover (no opt-in)  |
| `colDef.children` (groups)       | `children` (same)                                    |
| `gridOptions.onCellValueChanged` | `data:change` event                                  |
| `gridOptions.onSelectionChanged` | `selection:change` event                             |
| `gridApi.refreshCells()`         | not needed — reactive                                |
| `gridApi.applyTransaction()`     | `grid.batchUpdate(fn)`                               |
| Fill handle (Enterprise)         | built-in (MIT)                                       |
| Range selection (Enterprise)     | built-in (MIT)                                       |
| Excel clipboard (Enterprise)     | built-in (MIT)                                       |

## Components

### AG Grid

```tsx
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';

<AgGridReact
  rowData={rows}
  columnDefs={[
    { field: 'name', headerName: 'Name', editable: true },
    { field: 'age', headerName: 'Age', type: 'numericColumn' },
  ]}
  onCellValueChanged={(e) => console.log(e)}
/>;
```

### Gridsmith

```tsx
import { Grid } from '@gridsmith/react';

<Grid
  data={rows}
  columns={[
    { id: 'name', header: 'Name', type: 'text' },
    { id: 'age', header: 'Age', type: 'number' },
  ]}
  onCellChange={(change) => console.log(change)}
/>;
```

No theme CSS import is required — Gridsmith ships a self-contained default style.

## Cell editors

| AG Grid                | Gridsmith                                      |
| ---------------------- | ---------------------------------------------- |
| default text editor    | `type: 'text'`                                 |
| `agNumberCellEditor`   | `type: 'number'`                               |
| `agDateCellEditor`     | `type: 'date'`                                 |
| `agSelectCellEditor`   | `type: 'select'` + `selectOptions`             |
| `agCheckboxCellEditor` | `type: 'checkbox'`                             |
| custom React editor    | `cellEditor: ({ value, commit, cancel }) => …` |

```ts
// AG Grid
{
  field: 'role',
  cellEditor: 'agSelectCellEditor',
  cellEditorParams: { values: ['Admin', 'Member'] },
}

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

## Cell renderers

```tsx
// AG Grid
{
  field: 'avatar',
  cellRenderer: (params) => <Avatar src={params.value} />,
}

// Gridsmith
{
  id: 'avatar',
  cellRenderer: ({ value }) => <Avatar src={value as string} />,
}
```

## Events

| AG Grid              | Gridsmith                                 |
| -------------------- | ----------------------------------------- |
| `onCellValueChanged` | `data:change` event / `onCellChange` prop |
| `onSelectionChanged` | `selection:change`                        |
| `onColumnResized`    | `column:resize` / `onColumnResize`        |
| `onColumnMoved`      | `column:reorder` / `onColumnReorder`      |
| `onSortChanged`      | `sort:change` / `onSortChange`            |
| `onFilterChanged`    | `filter:change` / `onFilterChange`        |
| `onGridReady`        | `'ready'` event                           |

```ts
// AG Grid
<AgGridReact onCellValueChanged={(e) => save(e.data)} />

// Gridsmith
<Grid onCellChange={({ row, col, newValue }) => save(row, col, newValue)} />
```

## Server-side data

| AG Grid                               | Gridsmith                                       |
| ------------------------------------- | ----------------------------------------------- |
| `IServerSideDatasource` (Enterprise)  | `AsyncDataSource` (MIT)                         |
| `getRows({ startRow, endRow, ...})`   | `getRows({ start, end, sort, filter, signal })` |
| `params.successCallback(rows, total)` | return a `Promise<Row[]>`                       |

```ts
// AG Grid
gridOptions.serverSideDatasource = {
  getRows: (params) => {
    fetch(`/api?start=${params.startRow}&end=${params.endRow}`)
      .then((r) => r.json())
      .then((rows) => params.success({ rowData: rows, rowCount: rows.length }));
  },
};

// Gridsmith
createAsyncDataPlugin({
  source: {
    getRowCount: () => fetch('/api/count').then((r) => r.json()),
    getRows: ({ start, end, signal }) =>
      fetch(`/api?start=${start}&end=${end}`, { signal }).then((r) => r.json()),
  },
  pageSize: 100,
});
```

Gridsmith's source receives an `AbortSignal` so sort/filter changes can cancel in-flight requests — AG Grid Enterprise does not.

## Selection

| AG Grid (Enterprise)                     | Gridsmith (MIT)     |
| ---------------------------------------- | ------------------- |
| `enableRangeSelection: true`             | always on           |
| `gridApi.copySelectedRangeToClipboard()` | `clipboard.copy()`  |
| `gridApi.pasteFromClipboard()`           | `clipboard.paste()` |
| `enableFillHandle: true`                 | always on           |
| `enableRangeHandle: true`                | always on           |

## Validation

AG Grid does not have a first-class validation API. Gridsmith does:

```ts
{
  id: 'email',
  validate: (v) => /\S+@\S+\.\S+/.test(v as string) || 'Invalid email',
  asyncValidate: (v) => api.checkAvailability(v),
  validationMode: 'reject', // or 'warn'
}
```

See [Validation](/guides/validation).

## Themes

AG Grid has a Quartz / Alpine / Balham theme system with extensive variables. Gridsmith ships a single default style. To customize, override CSS variables — they're prefixed `--gs-`.

```css
:root {
  --gs-font-size: 14px;
  --gs-row-height: 36px;
  --gs-border: #e2e8f0;
  --gs-cell-active-border: #2563eb;
  --gs-cell-selected-bg: rgba(37, 99, 235, 0.08);
}
```

## Things AG Grid Enterprise has that Gridsmith does not

- **Master / detail** rows.
- **Tree data** — parent / child row hierarchies.
- **Grouping** + **aggregations** + **pivot**.
- **Excel export** with styles. (CSV export — implement in user code.)
- **Server-side row model** with full grouping / pivot / agg push-down.
- **Status bar** components.
- **Sparklines** in cells.
- **Rich select** editor.

## Things Gridsmith has that AG Grid Community lacks

- Range selection.
- Excel-compatible clipboard.
- Fill handle with pattern recognition.
- Undo / redo.
- Async data with infinite scroll + abort signal.
- Multi-level header groups.

…all without an Enterprise license.

## Migration checklist

1. Rename `field` → `id`, `headerName` → `header` in column defs.
2. Replace `cellEditor: 'agXxx'` strings with Gridsmith `type` values.
3. Move `onCellValueChanged` to `onCellChange` (or `grid.events.on('data:change', …)`).
4. Drop AG Grid's CSS imports.
5. Replace `IServerSideDatasource` with `AsyncDataSource`.
6. Drop license key — there isn't one.

## Need help?

[Open a discussion](https://github.com/retemper/gridsmith/discussions). The intent is full feature parity for the MIT user — concrete reports help us prioritize.
