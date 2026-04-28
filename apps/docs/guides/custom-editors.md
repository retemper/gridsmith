# Custom Editors

Built-in editors (`text` / `number` / `date` / `select` / `checkbox`) cover common cases. For richer inputs — autocompletes, masked phone fields, popovers, embedded pickers — register a custom editor.

There are two ways: **core** (`defineEditor`, framework-agnostic) and **React** (`cellEditor`, JSX).

## React editor (recommended for React apps)

Set `cellEditor` on the column. The function receives commit / cancel callbacks and renders any JSX:

```tsx
import { type GridColumnDef } from '@gridsmith/react';

const columns: GridColumnDef[] = [
  {
    id: 'tags',
    header: 'Tags',
    cellEditor: ({ value, commit, cancel }) => {
      const [draft, setDraft] = useState((value as string[]) ?? []);
      return (
        <TagPicker
          value={draft}
          onChange={setDraft}
          onConfirm={() => commit(draft)}
          onCancel={cancel}
        />
      );
    },
    cellRenderer: ({ value }) => (value as string[]).join(', '),
  },
];
```

`CellEditorProps`:

```ts
interface CellEditorProps {
  value: CellValue;
  row: Row;
  rowIndex: number;
  column: GridColumnDef;
  commit: (value: CellValue) => void;
  cancel: () => void;
}
```

- `commit(newValue)` fires the same flow as a built-in editor — runs through validation and undo.
- `cancel()` reverts and closes the editor.

## Core editor (`defineEditor`)

Framework-agnostic. Use this if you're building a non-React adapter.

```ts
import { createGrid, type EditorDefinition, type EditingPluginApi } from '@gridsmith/core';

const grid = createGrid({ data, columns });
const editing = grid.getPlugin<EditingPluginApi>('editing');

editing?.defineEditor({
  name: 'color',
  parse: (raw: string) => raw.trim(),
  format: (value) => (typeof value === 'string' ? value : ''),
});
```

Then reference it on the column:

```ts
{ id: 'brand', header: 'Brand', editor: 'color' }
```

The editor `name` field matches the `editor` string on the column. `defineEditor` takes a single `EditorDefinition` argument.

## Custom renderers (display-only)

`cellRenderer` is independent — it controls how the cell is **displayed** when not editing:

```tsx
{
  id: 'avatar',
  header: '',
  width: 48,
  editable: false,
  cellRenderer: ({ row }) => <Avatar src={row.avatarUrl as string} />,
}
```

## Tips

- **Focus management.** Inputs inside `cellEditor` should auto-focus on mount. Gridsmith opens the editor and hands focus to your DOM, but you control the rest.
- **Stop propagation carefully.** The grid listens for `Enter` / `Esc` / `Tab` on the editor host. If you `stopPropagation` you also opt out of those navigations.
- **IME-safe `Enter`.** If your input supports CJK composition, listen for `compositionstart`/`compositionend` and gate your own commit accordingly. The grid already does this for built-in editors.

## Related

- [Cell Editing](./editing) — the built-in editors and triggers.
- [Validation](./validation) — `commit(value)` runs validators.
