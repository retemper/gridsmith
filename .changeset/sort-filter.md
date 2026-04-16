---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add sort and filter support.

**Core (`@gridsmith/core`):**

- `ColumnDef` gains an optional `comparator` for per-column custom sort logic.
- `SortEntry` gains an optional `comparator` override that takes precedence
  over the column comparator.
- `FilterOperator` is extended with `regex`, `between`, `in`, and `notIn`.
- `FilterEntry.value` widens to
  `FilterValue = CellValue | readonly CellValue[] | RegExp`
  so `between` can take `[min, max]`, `in`/`notIn` can take arrays, and
  `regex` can take either a string pattern or a `RegExp` instance.
  **Migration:** code reading `entry.value` must narrow the union
  (`Array.isArray(entry.value)` / `entry.value instanceof RegExp`) before
  using it as a `CellValue`.
- New `CellComparator` and `FilterValue` types exported from the package
  root and re-exported from `@gridsmith/react`.
- Date comparison now uses `getTime()` internally for deterministic ordering
  and between-range semantics regardless of locale.
- `buildIndexMap` accepts an optional `columns` argument used to resolve
  per-column comparators.

**React (`@gridsmith/react`):**

- Column headers are now clickable and cycle sort direction
  (asc → desc → none). Shift+click composes a multi-column sort.
- A per-column filter button opens a type-aware filter popover with
  operators and inputs appropriate for text/number/date/select columns.
- Sort indicators (`▲` / `▼`, plus a sort-order number for multi-sort) are
  rendered next to the header label and `aria-sort` is populated on the
  header cell.
- Columns can opt out with `sortable: false` and/or `filterable: false`.
