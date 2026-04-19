---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Implement the WAI-ARIA 1.2 grid pattern and screen-reader announcements.

**Roles and indices (both renderers):**

- Grid root advertises `role="grid"` with `aria-rowcount` (counting
  header rows + pinned top + data + pinned bottom) and `aria-colcount`.
- Header container uses `role="rowgroup"`; each header row is wrapped
  in `role="row"` with a 1-based `aria-rowindex`.
- Header cells keep `role="columnheader"` and gain `aria-colindex`,
  plus `aria-colspan` / `aria-rowspan` for grouped columns.
- Data rows carry `role="row"` + `aria-rowindex` offset by header depth
  and pinned-top count; pinned rows use correct absolute indices.
- Every cell renders `role="gridcell"`, a stable `id`, and
  `aria-colindex`. Non-editable columns add `aria-readonly="true"`.

**Active cell tracking:**

- Grid root sets `aria-activedescendant` to the focused cell's id so
  screen readers announce focus movement without stealing DOM focus
  from the grid container (container-focus model).

**Validation:**

- The validation plugin's cell decorator now contributes
  `aria-invalid="true"` on error states (pending validations are not
  flagged), so renderers automatically surface the attribute on
  affected cells.

**Live regions:**

- Each grid creates a polite (`role="status"`) and an assertive
  (`role="alert"`) live region as siblings of the grid root. A
  150 ms-debounced announcer reports sort/filter summaries, paste
  dimensions, and validation errors without interrupting navigation.
- New exports from `@gridsmith/core`: `buildCellId`,
  `buildPinnedCellId`, `computeRowCount`, `createAnnouncer`,
  `dataRowAriaIndex`, `headerRowAriaIndex`, `nextGridInstanceId`,
  `pinnedBottomAriaIndex`, `pinnedTopAriaIndex`, plus the `Announcer`
  and `AriaRowCountInput` types. The id format produced by
  `buildCellId` / `buildPinnedCellId` is considered part of the public
  contract — future format changes will ship as a breaking change.
- New helper in `@gridsmith/react`: `useGridAnnouncements` wires a
  grid's lifecycle events to polite/assertive live-region refs. The
  React adapter derives its grid id from `useId()` so cell ids are
  stable across SSR hydration.
