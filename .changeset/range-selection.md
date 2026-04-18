---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add range selection: single, multi-range, row/column select.

**Core (`@gridsmith/core`):**

- New `createSelectionPlugin` exports a `'selection'` plugin that tracks one
  or more rectangular `CellRange`s plus a single `activeCell`.
- New types: `CellCoord`, `CellRange`, `SelectionState`, `SelectionMode`,
  `SelectionPluginApi`. `SelectionPluginApi` exposes `selectCell`,
  `addCell`, `extendTo`, `selectRow`, `selectColumn`, `selectAll`,
  `clear`, plus `isCellSelected` and `isCellActive` predicates.
- `addCell` toggles off an existing isolated single-cell range when called
  again on the same cell (Excel parity for Ctrl/Cmd+click).
- `getState()` returns a stable reference until the selection actually
  changes, so it composes cleanly with React's `useSyncExternalStore`.
- New `'selection:change'` grid event fires whenever the selection state
  changes; subscribers receive a defensive copy of the new state.
- The plugin installs a cell decorator that adds `gs-cell--selected` to any
  cell inside a range and `gs-cell--active` (with `gs-cell--focused` as an
  alias for backwards compatibility) to the active cell, plus
  `aria-selected="true"`.
- Selection auto-clears on `sort:change`, `filter:change`,
  `data:rowsUpdate`, and `columns:update` to avoid stale view indices, and
  on grid `destroy()`.

**React (`@gridsmith/react`):**

- Auto-registers the selection plugin alongside editing — no opt-in required.
- New `useGridSelection(grid)` hook returns the current
  `{ ranges, activeCell }` and re-renders on change.
- Mouse parity: click selects, Shift+click extends the active range,
  Ctrl/Cmd+click adds a disjoint range, and click-drag across cells extends
  a range.
- Keyboard parity with Excel: Shift+Arrow extends, Ctrl/Cmd+A selects all,
  Shift+Space selects the active row, Ctrl+Space selects the active column,
  Escape clears the current selection.
- Header label clicks select the entire column (with Ctrl/Cmd+click adding
  and Ctrl+Shift+click extending) — non-sortable columns still participate
  in selection via `aria-disabled`.
