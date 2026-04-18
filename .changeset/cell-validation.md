---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add cell validation with sync/async validators and visual indicators.

**Core (`@gridsmith/core`):**

- New `createValidationPlugin()` exports a `'validation'` plugin that
  records per-cell validation errors keyed by stable data index, so
  errors survive sort/filter/reorder.
- Columns can declare a sync `validate(value, ctx)` and/or an async
  `asyncValidate(value, ctx)`. A validator returns `true` for pass or
  a string message for fail.
- `validationMode: 'reject' | 'warn'` (default `reject`) controls
  commit behavior. In `reject`, a sync failure aborts the commit and
  the cell keeps its pre-edit value (the cell stays decorated only if
  that pre-edit value is itself invalid). In `warn`, the value commits
  and the error is decorated on the cell.
- The editing plugin calls `validateCell` before `setCell` so a
  rejected commit never touches grid data.
- `validateCellAsync` marks the cell as pending, applies the result
  on resolution, and discards stale results when newer validation
  runs supersede an in-flight one (token-based cancellation).
- Listens to `data:change` so programmatic writes (clipboard paste,
  fill handle, direct `setCell`) also trigger re-validation against
  the column's declared validators.
- `validateAll()` walks every row × validating column (including
  filtered-out rows, keyed by data-index) and returns the resulting
  error list. `clearErrors(rowIndex?, columnId?)` clears at global,
  row, column, or single-cell scope depending on which args are passed.
- Emits `'validation:change'` with the new error list whenever the
  error map changes, so adapters can react in a single place.
- Cell decorator adds `gs-cell--invalid` (with `title`,
  `data-validation-state`, `data-validation-message` attributes) and
  `gs-cell--validating` for pending async runs.
- New types: `ValidationResult`, `ValidationContext`, `SyncValidator`,
  `AsyncValidator`, `ValidationMode`, `ValidationErrorState`,
  `ValidationError`, `ValidationPluginApi`.

**React (`@gridsmith/react`):**

- Auto-registers the validation plugin alongside editing, selection,
  clipboard, history, and fill-handle.
- Subscribes to `'validation:change'` so cells re-render with the
  invalid/validating decoration and tooltip the moment validation
  state changes.
- New `useGridValidation(grid)` hook returns the plugin API (or
  `null` if not registered) for callers that want to inspect errors
  or trigger validation programmatically.
- Re-exports `createValidationPlugin`, `ValidationPluginApi`,
  `ValidationResult`, `ValidationContext`, `ValidationMode`,
  `ValidationErrorState`, `ValidationError`, `SyncValidator`, and
  `AsyncValidator`.
