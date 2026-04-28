# Change Tracking

The `changes` plugin marks every edited cell as **dirty** and lets you commit or revert in batch. Useful for forms, draft saves, and "save changes / discard" UI.

## Setup

Not auto-registered. Add it explicitly:

```tsx
import { Grid } from '@gridsmith/react';
import { createChangesPlugin } from '@gridsmith/core';

<Grid data={data} columns={columns} plugins={[createChangesPlugin()]} />;
```

`createChangesPlugin` is not re-exported from `@gridsmith/react` — import it from `@gridsmith/core` directly.

## Tracking semantics

- Every cell write is recorded against a stable data index, so dirty state survives sort, filter, and pinned-row reindexing.
- A cell edited back to its **original value** (including `Date` instances with the same epoch) auto-evicts from the dirty set.
- Wholesale `setData` and column-set changes invalidate the affected entries; pure column reorders do not.

## API

```ts
import type { ChangesPluginApi } from '@gridsmith/react';

const changes = grid.getPlugin<ChangesPluginApi>('changes');

const dirty = changes.getDirty();
// CellChange[] — { row, col, oldValue, newValue }

changes.isDirty(rowIndex, columnId); // boolean

changes.commit(); // accept current values as the new baseline; clears dirty
changes.revert(); // restore every dirty cell to its original (1 undo step)
```

`commit` does **not** touch cell values or undo history — it just resets the baseline. `revert` writes through `grid.batchUpdate`, so it's one undoable step.

## Visual indicator

Dirty cells get the `gs-cell--dirty` class. Style as you like — for example a corner triangle:

```css
.gs-cell--dirty {
  position: relative;
}
.gs-cell--dirty::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border-top: 6px solid #2563eb;
  border-left: 6px solid transparent;
}
```

## Events

| Event            | Payload                     |
| ---------------- | --------------------------- |
| `changes:update` | `{ dirty: CellChange[] }`   |
| `changes:commit` | `{ changes: CellChange[] }` |
| `changes:revert` | `{ changes: CellChange[] }` |

## Pattern: Save / Discard buttons

```tsx
function Toolbar({ grid }: { grid: GridInstance }) {
  const [dirty, setDirty] = useState<CellChange[]>([]);

  useEffect(() => {
    const off = grid.events.on('changes:update', ({ dirty }) => setDirty([...dirty]));
    return () => off();
  }, [grid]);

  const changes = grid.getPlugin<ChangesPluginApi>('changes');

  const onSave = async () => {
    await api.persist(dirty);
    changes?.commit();
  };

  return (
    <div>
      <button onClick={onSave} disabled={dirty.length === 0}>
        Save ({dirty.length})
      </button>
      <button onClick={() => changes?.revert()} disabled={dirty.length === 0}>
        Discard
      </button>
    </div>
  );
}
```

## Related

- [Validation](./validation) — gate `commit()` on validity.
- [Undo / Redo](./undo-redo) — `revert()` is one undo step.
