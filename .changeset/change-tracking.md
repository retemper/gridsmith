---
'@gridsmith/core': minor
---

Add change tracking with dirty-cell marking, batch commit, and batch revert.

**Core (`@gridsmith/core`):**

- New `createChangesPlugin()` exports a `'changes'` plugin that tracks
  every cell edit since the last commit/revert. Entries are keyed by
  stable data index, so dirty state survives sort, filter, and pinned-
  row reindexing.
- `ChangesPluginApi`:
  - `getDirty(): CellChange[]` — snapshot of every dirty cell with its
    original and current values.
  - `isDirty(rowIndex, columnId): boolean` — view-indexed lookup.
  - `commit()` — accept the current values as the new baseline; clears
    the dirty set without touching cell values or undo history.
  - `revert()` — restore every dirty cell to its original value in a
    single `grid.batchUpdate` (one undoable step when history is
    present).
- Cells in the dirty set pick up a `gs-cell--dirty` CSS class via the
  cell-decorator hook so adapters can render an indicator (e.g. a
  blue corner triangle).
- New events on `GridEvents`: `'changes:update'` (fires on any dirty-
  state mutation), `'changes:commit'`, and `'changes:revert'`, each
  carrying the relevant `CellChange[]` snapshot.
- A cell edited back to its original value — including `Date`
  instances with the same epoch — is automatically evicted from the
  dirty set.
- Wholesale `setData` and column-set changes (removing a column via
  `setColumns`) invalidate the affected entries; pure column
  reorders do not.
