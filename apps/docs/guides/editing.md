# Cell Editing

The editing plugin is auto-registered by `<Grid />`. This page covers the built-in editors, the `editable` flag, and how edits flow through the grid.

## Triggers

| Action            | What it does                              |
| ----------------- | ----------------------------------------- |
| Double-click cell | Begin editing                             |
| `F2` or `Enter`   | Begin editing the focused cell            |
| Type a character  | Begin editing and replace the value       |
| `Enter`           | Commit and move down                      |
| `Shift+Enter`     | Commit and move up                        |
| `Tab`             | Commit and move right (wraps to next row) |
| `Shift+Tab`       | Commit and move left                      |
| `Esc`             | Cancel — revert to the pre-edit value     |

IME composition is respected — `Enter`/`Tab` during Korean / Japanese / Chinese composition do not commit prematurely.

## Built-in editors

Pick one with `type` (which defaults the editor) or `editor` (explicit):

```ts
const columns: GridColumnDef[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'price', header: 'Price', type: 'number' },
  { id: 'in_stock', header: 'In Stock', type: 'checkbox' },
  { id: 'joined', header: 'Joined', type: 'date' }, // YYYY-MM-DD
  {
    id: 'role',
    header: 'Role',
    type: 'select',
    selectOptions: [
      { label: 'Admin', value: 'admin' },
      { label: 'Member', value: 'member' },
    ],
  },
];
```

Parsing on commit:

| Editor     | Stored as                              |
| ---------- | -------------------------------------- |
| `text`     | `string`                               |
| `number`   | `number`, or `null` if empty / invalid |
| `checkbox` | `boolean`                              |
| `date`     | `Date`, parsed from ISO `YYYY-MM-DD`   |
| `select`   | the option's `value`                   |

## Read-only cells

Mark a column or a single cell as read-only:

```ts
{ id: 'id', header: '#', editable: false }
```

Read-only columns:

- Skip editor activation.
- Are skipped by clipboard paste, fill, and `deleteSelection`.
- Render with `aria-readonly="true"`.

## Reacting to edits

```tsx
<Grid
  data={rows}
  columns={columns}
  onCellChange={({ row, col, oldValue, newValue }) => {
    setRows((prev) => {
      const next = [...prev];
      next[row] = { ...next[row], [col]: newValue };
      return next;
    });
  }}
/>
```

`row` is the **view** index (after sort / filter). If you need to write to underlying data, look up by a stable id in your row.

## Programmatic writes

When you have access to the grid instance (via `useGrid`):

```ts
grid.setCell(rowIndex, columnId, value); // single
grid.batchUpdate(() => {
  // multiple = 1 undo step
  grid.setCell(0, 'price', 9.99);
  grid.setCell(1, 'price', 12.5);
});
```

`setCell` resolves the view index → underlying data index via the index map, so it works correctly under sort / filter.

## Custom editors

Built-in editors cover the basics. For richer editors (autocompletes, masked inputs, popovers), see [Custom Editors](./custom-editors).

## Validation

Editors hand off to the [Validation](./validation) plugin before each commit. Use `validate` for sync rules and `asyncValidate` for server checks.

## Related

- [Validation](./validation) — block or warn on bad input.
- [Undo / Redo](./undo-redo) — every edit is an undo step.
- [Custom Editors](./custom-editors) — `defineEditor` and React `cellEditor`.
