# Undo / Redo

The history plugin records every grid mutation and exposes undo / redo. It's auto-registered.

## Keyboard

| Keys                                     | Action |
| ---------------------------------------- | ------ |
| `Ctrl/Cmd + Z`                           | Undo   |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo   |

When focus is on a sibling text input, the grid does not intercept — native input undo runs.

## What gets recorded

The plugin listens to:

- `data:change` — cell writes (edit, paste, fill, delete, programmatic)
- `sort:change` — sort transitions
- `column:reorder` — column moves

Sort and reorder are reversible. Async data **loads** are not recorded (see below).

## Transactions

Multiple mutations inside `grid.batchUpdate(fn)` collapse into one undoable step. So:

- A multi-cell paste = 1 undo
- A multi-cell delete = 1 undo
- A fill of N cells = 1 undo

Repeated touches on the same cell within a batch coalesce, preserving the original `oldValue`.

## API

```ts
const history = grid.getPlugin<HistoryPluginApi>('history');

history.undo(); // returns boolean — false when stack is empty
history.redo(); // returns boolean
history.canUndo(); // boolean
history.canRedo(); // boolean
history.getUndoSize(); // number
history.getRedoSize(); // number
history.clear();
history.setMaxSize(200);

// Group your own writes:
history.batch(() => {
  grid.setCell(0, 'a', 1);
  grid.setCell(1, 'a', 2);
}); // single undo step

// Suppress recording (used by async data loads):
history.suppress(() => {
  // writes here don't enter the undo stack
  populatePage(rows);
});
```

## Stack size

Default `maxSize` is **100**. Configure at construction:

```ts
import { createHistoryPlugin } from '@gridsmith/react';

createHistoryPlugin({ maxSize: 500 });
```

When the limit is hit, oldest entries are dropped. Any new mutation clears the redo stack.

## Filtered-out rows

Each command stores enough before/after state to restore values **even when the affected row is currently filtered out**. Internally the plugin uses `setCellByDataIndex` to bypass the view-index lookup.

## Events

| Event               | Payload                                    |
| ------------------- | ------------------------------------------ |
| `transaction:begin` | `{ depth }`                                |
| `transaction:end`   | `{ depth }`                                |
| `history:change`    | `{ canUndo, canRedo, undoSize, redoSize }` |

## Custom commands

You can push your own command for non-data state (e.g. a custom plugin's UI state):

```ts
history.push({
  label: 'Toggle highlight',
  redo: () => setHighlight(true),
  undo: () => setHighlight(false),
});
```

## Related

- [Cell Editing](./editing) — every commit becomes one entry.
- [Async Data](./async-data) — data loads are suppressed via `history.suppress`.
