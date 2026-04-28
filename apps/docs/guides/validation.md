# Validation

Per-column sync and async validators with visual indicators. The validation plugin is auto-registered.

## Sync validators

```ts
const columns: GridColumnDef[] = [
  {
    id: 'name',
    header: 'Name',
    type: 'text',
    validate: (value) => (typeof value === 'string' && value.length > 0) || 'Name is required',
  },
  {
    id: 'age',
    header: 'Age',
    type: 'number',
    validate: (value) =>
      (typeof value === 'number' && value >= 0 && value < 150) || 'Age must be 0–149',
  },
];
```

Return `true` to pass, or a string message to fail.

## Validation modes

```ts
{ id: 'age', validate: ageRule, validationMode: 'warn' } // default 'reject'
```

| Mode     | Behavior on failure                                            |
| -------- | -------------------------------------------------------------- |
| `reject` | Commit aborts. The cell keeps its pre-edit value. Default.     |
| `warn`   | Commit succeeds. The cell is decorated with the error message. |

In `reject` mode the cell still keeps its decoration if the **pre-edit** value was itself invalid.

## Async validators

```ts
{
  id: 'email',
  asyncValidate: async (value, ctx) => {
    const exists = await api.checkEmail(value as string);
    return exists ? 'Email already in use' : true;
  },
}
```

While the async run is pending, the cell carries `gs-cell--validating` (and `aria-busy="true"` if you wire it). Stale results are dropped — if a newer commit lands while the previous run is still in flight, the older response is discarded.

## Validation context

```ts
interface ValidationContext {
  rowIndex: number; // view-row at validation time
  dataIndex: number; // stable, survives sort/filter
  columnId: string;
  row: Row; // snapshot of committed row values
}
```

You can cross-reference other cells in the same row:

```ts
validate: (value, { row }) => row.password === value || 'Passwords must match';
```

Note `row` is the snapshot of the row's _committed_ values — the candidate value being validated is the validator's first argument, not `row[columnId]`.

## API

```ts
const validation = grid.getPlugin<ValidationPluginApi>('validation');

const errors = validation.getErrors(); // readonly ValidationError[]
validation.validateAll(); // also returns the resulting error list
validation.getError(rowIndex, columnId); // ValidationError | null
validation.isPending(rowIndex, columnId); // boolean — async in flight
validation.clearErrors(); // clear all
validation.clearErrors(rowIndex); // clear row
validation.clearErrors(rowIndex, columnId); // clear single cell
```

`ValidationError` is keyed by `dataIndex` (stable), so errors follow the underlying row across sort, filter, and reorder. The shape:

```ts
interface ValidationError {
  dataIndex: number;
  columnId: string;
  message: string; // empty while pending
  value: CellValue;
  state: 'invalid' | 'validating' | 'valid';
}
```

## Reacting to validation state

```ts
grid.events.on('validation:change', ({ errors }) => {
  setHasErrors(errors.length > 0);
});
```

In React headless mode, use [`useGridValidation`](/api/react#usegridvalidation).

## Visual indicators

Cells in error state get:

- `gs-cell--invalid` class
- `title` and `data-validation-message` attributes
- `aria-invalid="true"` (via the a11y plugin)

Pending async cells get `gs-cell--validating`.

## What triggers validation

- An edit committing through the editor.
- Programmatic `setCell`, paste, fill, undo / redo — anything that fires `data:change`.
- Explicit `validateAll()` / `validateCell()` calls.

## Related

- [Cell Editing](./editing) — validators run before commit.
- [Change Tracking](./change-tracking) — validate before committing dirty cells.
