# @gridsmith/core

## 1.0.3

### Patch Changes

- [#56](https://github.com/retemper/gridsmith/pull/56) [`f82ff5d`](https://github.com/retemper/gridsmith/commit/f82ff5d0aca01d7d01c78e458fd7ab83b9310921) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Re-attempt the 1.0.x publish via npm Trusted Publishing.

  The 1.0.2 publish workflow signed the Sigstore provenance attestation
  successfully but the registry PUT was rejected with `E404`. Root cause: the
  `actions/setup-node` step had `registry-url: 'https://registry.npmjs.org'`,
  which writes an `.npmrc` containing `_authToken=${NODE_AUTH_TOKEN}`. With no
  token in scope the line still resolves to "auth configured but empty", and
  npm CLI 11 falls through to that empty credential instead of switching to the
  OIDC trusted-publishing flow. Dropping `registry-url` from `setup-node`
  removes the stub `.npmrc`, so npm CLI sees no configured auth and exchanges
  the workflow's OIDC identity for a short-lived publish token as intended.

## 1.0.2

### Patch Changes

- [#54](https://github.com/retemper/gridsmith/pull/54) [`736835b`](https://github.com/retemper/gridsmith/commit/736835bf48f17c439709b68a435f3d9de0a98f5e) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Re-attempt the 1.0.x publish via npm Trusted Publishing.

  The 1.0.1 publish workflow failed at the "Install npm" step: `npm install -g npm@latest`
  crashed mid-upgrade with `Cannot find module 'promise-retry'`, a known
  self-replacement bug in npm 10.x. The publish job now installs the newer npm
  into a separate prefix (`$HOME/.npm-trusted`) and prepends it to `PATH`, which
  avoids touching the running npm's module tree. No package behavior changes; this
  release is the first to actually ship through OIDC + provenance attestation.

## 1.0.1

### Patch Changes

- [#52](https://github.com/retemper/gridsmith/pull/52) [`4e18545`](https://github.com/retemper/gridsmith/commit/4e18545ce4cd27d332dd5cd00b01d725ce186d1e) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Switch the release pipeline to npm Trusted Publishing (OIDC) and enable provenance attestations.

  Each tarball now ships with a Sigstore-signed npm provenance attestation linking the
  release back to the GitHub Actions workflow that built it
  (`retemper/gridsmith` → `.github/workflows/publish.yml`). Consumers can verify the
  chain with `npm audit signatures`. No long-lived npm token is required for releases —
  the publish workflow authenticates to the registry via short-lived GitHub OIDC
  identities scoped to this repo and workflow path.

## 1.0.0

### Major Changes

- [#50](https://github.com/retemper/gridsmith/pull/50) [`63f1587`](https://github.com/retemper/gridsmith/commit/63f158797b94465abe8f35d904bd45375864d274) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Gridsmith 1.0 — first stable release.

  Marks the public API surface as stable. Includes the headless core with reactive
  state, plugin system, and event bus; the DOM renderer with row + column
  virtualization; the React adapter with `<Grid />` and hooks; and the full
  Excel-grade editing engine — selection, clipboard (TSV + HTML), fill handle
  with pattern detection, undo/redo, validation, sort/filter, column
  resize/reorder/pinning, row pinning, multi-level group headers, async data
  source with infinite scroll, change tracking, keyboard navigation with IME
  support, and the WAI-ARIA grid pattern with screen-reader announcements.

  See the individual changesets in this release for per-feature details.

### Minor Changes

- [#47](https://github.com/retemper/gridsmith/pull/47) [`b767e4e`](https://github.com/retemper/gridsmith/commit/b767e4ed76aef1327ce5144a849cb54aa7c887d7) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Implement the WAI-ARIA 1.2 grid pattern and screen-reader announcements.

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

- [#45](https://github.com/retemper/gridsmith/pull/45) [`ea18cef`](https://github.com/retemper/gridsmith/commit/ea18cef7e203f4828fe3a4ae4bcfdab0e8f146b7) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add async data source + infinite scroll plugin.

  **Core (`@gridsmith/core`):**
  - New `createAsyncDataPlugin({ source, pageSize?, serverSideSort?, serverSideFilter? })`
    replaces `grid.data` with a dense array of placeholder rows sized
    to the server-reported total, then fills windows in place on demand
    via `api.loadRange(start, end)`.
  - `AsyncDataSource` interface: `getRows({ start, end, sort?, filter?, signal? })`
    and `getRowCount({ sort?, filter?, signal? })`. Both receive an
    `AbortSignal` so cache invalidations (sort/filter change, `refresh()`)
    can cancel in-flight HTTP work.
  - Page-keyed dedupe: overlapping `loadRange` calls coalesce into one
    server request per page; concurrent callers share the same promise.
  - Generation counter drops stale writes if a fetch resolves after its
    invalidation, guaranteeing sort/filter transitions never paint old
    data on top of new.
  - `'sort:change'` clears placeholders (row count unchanged); `'filter:change'`
    re-fetches the row count first, then reseeds. Both bypass the undo
    stack by design — sort/filter is already a user-visible state change
    the history plugin handles natively.
  - Populated cells are written inside `history.suppress(...)` when the
    history plugin is registered, so loaded rows never enter the undo
    stack. `batchUpdate` coalesces the flurry of `data:change` events.
  - Cell decorator adds `gs-cell--loading` and `data-loading="true"` to
    not-yet-loaded rows so adapters can render a skeleton.
  - New events: `'asyncData:ready'`, `'asyncData:loading'`, `'asyncData:loaded'`,
    `'asyncData:error'`.
  - New API: `loadRange`, `refresh`, `getTotalCount`, `isRowLoaded`, `isLoading`.
  - New types: `AsyncDataSource`, `AsyncDataSourceParams`,
    `AsyncDataSourceCountParams`, `AsyncDataPluginOptions`,
    `AsyncDataPluginApi`.
  - Placeholder rows carry a `PLACEHOLDER_ROW` symbol; the index map
    bypasses client-side filter predicates for those rows so they stay
    visible during a refetch.
  - `HistoryPluginApi` adds `suppress<T>(fn: () => T): T` — a refcounted
    scope that tells history to ignore `data:change`/`selection:change`
    while plugins bulk-populate rows.

  **React (`@gridsmith/react`):**
  - Viewport effect calls `asyncData.loadRange(rowStart, rowEnd)` whenever
    the visible range or total row count moves, so scrolling fetches the
    next window automatically. Noop when the plugin isn't registered.
  - Re-exports `createAsyncDataPlugin`, `AsyncDataSource`,
    `AsyncDataSourceParams`, `AsyncDataSourceCountParams`,
    `AsyncDataPluginOptions`, `AsyncDataPluginApi`.

- [#33](https://github.com/retemper/gridsmith/pull/33) [`770f8d3`](https://github.com/retemper/gridsmith/commit/770f8d352f2777787ec6ef3b8e6aa4ea7f0ca8b9) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add basic cell editing: text/number/select/checkbox/date editors, `defineEditor` custom editor API, double-click/F2/type-to-edit, Enter/Esc/Tab behavior, and `editable` column flag for read-only cells

- [#44](https://github.com/retemper/gridsmith/pull/44) [`ae2cbdc`](https://github.com/retemper/gridsmith/commit/ae2cbdce2236c7239f2d835115b8143670fea769) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add cell validation with sync/async validators and visual indicators.

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

- [#46](https://github.com/retemper/gridsmith/pull/46) [`d846fc1`](https://github.com/retemper/gridsmith/commit/d846fc1fe065caa0df5a2c47482cb9a35bc9713f) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add change tracking with dirty-cell marking, batch commit, and batch revert.

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

- [#38](https://github.com/retemper/gridsmith/pull/38) [`eb5233e`](https://github.com/retemper/gridsmith/commit/eb5233e4cdced8ba2eacdc3e177c4b4e506c626c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add column resize, reorder, and pinning (left/right) with row pinning (top/bottom)

- [#31](https://github.com/retemper/gridsmith/pull/31) [`27caa84`](https://github.com/retemper/gridsmith/commit/27caa84b5db3e2a37648a20ba42037eb28b6e9c5) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add DOM renderer with row/column virtualization
  - `createRenderer()` mounts a virtualized grid into a container element
  - Row virtualization with fixed height for O(1) position calculation
  - Column virtualization with binary search for variable-width columns
  - Overscan buffer for smooth scrolling
  - ResizeObserver for container resize handling
  - Row element pooling to minimize GC pressure
  - Reactive: auto-updates on data, sort, filter, and column changes

- [#41](https://github.com/retemper/gridsmith/pull/41) [`522c642`](https://github.com/retemper/gridsmith/commit/522c6422510df8a68669c116c0d7286d2eecfe82) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add Excel-compatible clipboard: TSV + HTML copy, paste, cut, delete.

  **Core (`@gridsmith/core`):**
  - New `createClipboardPlugin` exports a `'clipboard'` plugin that depends
    on `'selection'` and round-trips cell values with Excel and Google
    Sheets.
  - New types: `ClipboardPayload`, `ClipboardMatrix`, `ClipboardPluginApi`.
    The API exposes `copy`, `cut`, `paste`, `deleteSelection`,
    `serializeRange`, `parsePayload`, and `applyMatrix` for programmatic
    use.
  - Copy writes both `text/plain` (TSV) and `text/html` (minimal `<table>`)
    via the modern `ClipboardItem` API, with a `writeText` fallback when
    rich writes are unavailable or denied.
  - Paste prefers parsed HTML tables and falls back to TSV; multi-line
    quoted cells and Excel's trailing CRLF are handled transparently.
  - Values are formatted for Excel compatibility: booleans as `TRUE`/`FALSE`,
    dates as `YYYY-MM-DD`, `null`/`undefined` as empty string. Paste coerces
    strings back to the target column's declared type (`number`, `checkbox`,
    `date`) and leaves unrecognized input as raw text.
  - `deleteSelection` clears every editable cell across all ranges, skips
    `editable: false` columns, and batches changes in a single update.
  - New grid events: `clipboard:copy`, `clipboard:cut`, `clipboard:paste`.

  **React (`@gridsmith/react`):**
  - Auto-registers the clipboard plugin alongside editing and selection.
  - Keyboard parity with Excel: Ctrl/Cmd+C copies the active range,
    Ctrl/Cmd+X cuts, Ctrl/Cmd+V pastes at the active cell, and
    Delete/Backspace clears every selected cell (falling back to the
    focused cell when there is no range selection).
  - Sibling text inputs (e.g. filter popovers) keep native clipboard
    behavior — the grid only intercepts when focus is on the grid itself.
  - New `useGridClipboard(grid)` hook exposes the clipboard API for
    programmatic copy/cut/paste in custom toolbars.

- [#43](https://github.com/retemper/gridsmith/pull/43) [`ba69031`](https://github.com/retemper/gridsmith/commit/ba69031612f46109f1e0633eecb703f429305640) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add Excel-style fill handle with pattern recognition.

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

- [#30](https://github.com/retemper/gridsmith/pull/30) [`28849ce`](https://github.com/retemper/gridsmith/commit/28849ce85db2db02e9cbe469887bb4f31a38f236) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add headless core: createGrid() API with reactive state management, plugin system, event bus, sort/filter index mapping

- [#39](https://github.com/retemper/gridsmith/pull/39) [`d2b848d`](https://github.com/retemper/gridsmith/commit/d2b848d9eec7fcbb6522e110c702ec8122944b6c) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add multi-level group headers. `ColumnDef` (and `GridColumnDef`) now accepts a `children` tree; headers render spanning cells above the leaf columns. New exports: `flattenColumns`, `getHeaderDepth`, `buildHeaderRows`, `setLeafWidth`, `columnStructureKey`, `HeaderCell`. `GridInstance` exposes the original tree as `columnDefs` alongside the flat `columns` signal and emits a `columnDefs:update` event. Data operations (sort/filter/edit) continue to operate on leaf columns only; `reorderColumn` warns and no-ops when groups are present (deferred to Phase 2). `resizeColumn` now emits `column:resize` + `columnDefs:update` only — width-only changes no longer re-fire `columns:update`, since the leaf list is structurally unchanged.

- [#40](https://github.com/retemper/gridsmith/pull/40) [`0bbabd4`](https://github.com/retemper/gridsmith/commit/0bbabd48ade3139fd2258c993c774e26ecce58ef) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add range selection: single, multi-range, row/column select.

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

- [#35](https://github.com/retemper/gridsmith/pull/35) [`489efb3`](https://github.com/retemper/gridsmith/commit/489efb37d7c73466bcd2e3fc5fd670364a628c09) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add sort and filter support.

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

- [#42](https://github.com/retemper/gridsmith/pull/42) [`7255f26`](https://github.com/retemper/gridsmith/commit/7255f26c9bbad79ba78e5df870fbdfeed4872db1) Thanks [@devKangMinHyeok](https://github.com/devKangMinHyeok)! - Add Undo/Redo with Command pattern.

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
