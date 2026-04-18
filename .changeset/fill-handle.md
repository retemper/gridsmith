---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add Excel-style fill handle with pattern recognition.

**Core (`@gridsmith/core`):**

- New `createFillHandlePlugin(options?)` exports a `'fill-handle'` plugin
  that extends a source range into a larger target range along one axis,
  inferring a pattern from the source values.
- `inferPattern(values)` detects: arithmetic progressions (integer or
  float with a small tolerance), dates advanced by one day, short/long
  day-of-week names (Mon/Monday, case-insensitive), short/long month
  names (Jan/January), prefix-number strings (`Q1`, `item-7`), any
  registered custom list, and falls back to `copy` otherwise. A single
  cell that matches a known list (built-in or custom) also extrapolates
  as that list — matching Excel's behavior when dragging a single "Mon"
  or "January".
- `generateValues(source, count, direction)` produces forward or reverse
  extrapolations, cycling lists with a modular wrap so a day-name drag
  of any length wraps cleanly past the week boundary.
- `fill({ source, target })` applies the inferred pattern across the
  extension, skipping columns where `editable === false`. Rejects
  targets that don't strictly enclose the source, and rejects
  two-axis extensions (Excel only extrapolates along one axis).
- All writes go through `grid.batchUpdate()`, so a full fill is one
  undo step and all downstream listeners (including the history plugin)
  see a single transaction.
- `registerCustomList(list)` / `getCustomLists()` let callers add their
  own cyclic lists at runtime; built-in day/month lists are always
  active. Initial lists can also be passed via the `customLists` option.
- New types: `FillPatternKind`, `FillDirection`, `FillPattern`,
  `FillOperation`, `FillHandlePluginOptions`, `FillHandlePluginApi`.

**React (`@gridsmith/react`):**

- Auto-registers the fill-handle plugin alongside editing, selection,
  clipboard, and history.
- Renders an 8×8 handle at the bottom-right corner of the active
  selection range when not editing. Pointer-drag on the handle extends
  the selection and fills on release; direction is chosen by the
  dominant axis of the drag. During the drag a dashed preview rectangle
  shows the pending target.
- After a successful fill the target range becomes the new selection,
  matching Excel.
- New `useGridFillHandle(grid)` hook returns the plugin API (or `null`
  if the plugin isn't registered) for callers that want to trigger
  fills programmatically or register custom lists.
- Re-exports `createFillHandlePlugin`, `FillHandlePluginApi`,
  `FillHandlePluginOptions`, `FillPattern`, `FillPatternKind`,
  `FillDirection`, and `FillOperation` for direct API use.
