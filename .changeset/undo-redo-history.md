---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add Undo/Redo with Command pattern.

**Core (`@gridsmith/core`):**

- New `createHistoryPlugin(options?)` exports a `'history'` plugin that
  records every grid mutation and exposes `undo`, `redo`, `canUndo`,
  `canRedo`, `batch`, `push`, `clear`, `getUndoSize`, `getRedoSize`, and
  `setMaxSize`.
- Listens to `data:change`, `sort:change`, and `column:reorder` to build
  reversible commands. Each command stores enough before/after state to
  restore even when the affected row is currently filtered out.
- Multiple mutations inside `grid.batchUpdate(fn)` (or `history.batch(fn)`)
  collapse into a single undoable entry, so a paste of N cells, a multi-
  cell delete, or a cut all undo as one step. Repeated touches on the
  same cell within a batch coalesce, preserving the original `oldValue`.
- Stack size defaults to 100 (configurable via `maxSize` option or
  `setMaxSize` at runtime); oldest entries are dropped when exceeded.
  Any new mutation clears the redo stack.
- New `transaction:begin` / `transaction:end` events bracket every
  `grid.batchUpdate` call so plugins can observe transaction boundaries.
  New `history:change` event fires whenever undo/redo state changes.
- New `setCellByDataIndex(dataIndex, columnId, value)` on `GridInstance`
  writes a cell by its underlying data index, bypassing the sort/filter
  view — used by undo/redo to restore values for off-view rows.
- New types: `Command`, `HistoryPluginApi`, `HistoryPluginOptions`.

**React (`@gridsmith/react`):**

- Auto-registers the history plugin alongside editing, selection, and
  clipboard.
- Keyboard parity with Excel: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and
  Ctrl/Cmd+Y redo. Sibling text inputs (e.g. filter popovers) keep
  native undo behavior.
- Re-exports `createHistoryPlugin`, `HistoryPluginApi`,
  `HistoryPluginOptions`, and `Command` for direct API use.
