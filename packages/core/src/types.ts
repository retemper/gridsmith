import type { EventBus } from './events';
import type { Signal, Computed, ReadonlySignal, Unsubscribe } from './signal';

// ─── Cell & Data ───────────────────────────────────────────

export type CellValue = string | number | boolean | Date | null | undefined;

export type Row = Record<string, CellValue>;

// ─── Column Definition ─────────────────────────────────────

export type ColumnType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

export type PinPosition = 'left' | 'right' | false;

export interface SelectOption {
  label: string;
  value: string | number;
}

/**
 * Custom comparator for sorting a column. Must return a negative, zero, or
 * positive number like `Array.prototype.sort`. Direction (asc/desc) is applied
 * on top of the comparator's result by the core.
 */
export type CellComparator = (a: CellValue, b: CellValue) => number;

export interface ColumnDef {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  type?: ColumnType;
  pin?: PinPosition;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  visible?: boolean;
  /** Whether this column is editable (default: true) */
  editable?: boolean;
  /** Editor type name — defaults to column `type` or 'text' */
  editor?: string;
  /** Options for select-type editors */
  selectOptions?: SelectOption[];
  /** Custom comparator for sorting this column. Overrides the default. */
  comparator?: CellComparator;
  /**
   * Synchronous validator. Return `true` when the value is valid or a string
   * error message when it isn't. Runs on commit; the result is forwarded to
   * the validation plugin which records/decorates errors.
   */
  validate?: SyncValidator;
  /**
   * Asynchronous validator. Runs alongside `validate` (not a fallback). The
   * cell is flagged `pending` until the promise settles; async failures
   * never block commit — they only surface as a post-hoc error.
   */
  asyncValidate?: AsyncValidator;
  /**
   * How a synchronous validation failure is handled on commit.
   * - `reject` (default): cancel the commit, keep the original value.
   * - `warn`: accept the value but record the error for UI feedback.
   */
  validationMode?: ValidationMode;
  /**
   * Nested child columns. When set, this entry is treated as a header group:
   * it renders a spanning header cell above its children and does not carry
   * its own data. Data operations (sort/filter/edit) run on leaf columns only.
   */
  children?: ColumnDef[];
}

// ─── Sort & Filter ─────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortEntry {
  columnId: string;
  direction: SortDirection;
  /** Per-sort comparator override; takes precedence over column comparator. */
  comparator?: CellComparator;
}

export type SortState = SortEntry[];

/**
 * Filter value.
 * - `between` expects a 2-tuple `[min, max]` (inclusive on both ends).
 * - `in` / `notIn` expect an array of candidate values.
 * - `regex` accepts either a `RegExp` instance or a string pattern.
 * - All other operators expect a single `CellValue`.
 */
export type FilterValue = CellValue | readonly CellValue[] | RegExp;

export interface FilterEntry {
  columnId: string;
  operator: FilterOperator;
  value: FilterValue;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'in'
  | 'notIn';

export type FilterState = FilterEntry[];

// ─── Index Map ─────────────────────────────────────────────

export interface IndexMap {
  viewToData(viewIndex: number): number;
  dataToView(dataIndex: number): number | null;
  readonly length: number;
}

// ─── Viewport ──────────────────────────────────────────────

export interface ViewportState {
  scrollTop: number;
  scrollLeft: number;
  containerWidth: number;
  containerHeight: number;
}

export interface VisibleRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

// ─── Cell Change ───────────────────────────────────────────

export interface CellChange {
  row: number;
  col: string;
  oldValue: CellValue;
  newValue: CellValue;
}

// ─── Grid Events ───────────────────────────────────────────

export interface GridEvents {
  'data:change': { changes: CellChange[] };
  'data:rowsUpdate': { data: Row[] };
  'columns:update': { columns: ColumnDef[] };
  'columnDefs:update': { columnDefs: ColumnDef[] };
  'sort:change': { sort: SortState };
  'filter:change': { filter: FilterState };
  'viewport:change': { viewport: ViewportState };
  'column:resize': { columnId: string; width: number };
  'column:reorder': { columnId: string; fromIndex: number; toIndex: number };
  'edit:begin': EditState;
  'edit:commit': {
    rowIndex: number;
    columnId: string;
    oldValue: CellValue;
    newValue: CellValue;
  };
  'edit:cancel': { rowIndex: number; columnId: string };
  'selection:change': SelectionState;
  'clipboard:copy': { range: CellRange; rows: number; cols: number };
  'clipboard:cut': { range: CellRange; rows: number; cols: number };
  'clipboard:paste': { target: CellCoord; rows: number; cols: number };
  // Transaction boundaries fired around `grid.batchUpdate`. The history
  // plugin uses these to coalesce many mutations into a single undoable
  // command. Nested batches increment depth — only the outermost end emits
  // a usable boundary for plugins counting depth themselves.
  'transaction:begin': { depth: number };
  'transaction:end': { depth: number };
  'history:change': { canUndo: boolean; canRedo: boolean; undoSize: number; redoSize: number };
  'validation:change': { errors: readonly ValidationError[] };
  'asyncData:ready': { totalCount: number };
  'asyncData:loading': { start: number; end: number };
  'asyncData:loaded': { start: number; end: number; totalCount: number };
  'asyncData:error': { error: Error; start?: number; end?: number };
  'plugin:ready': { name: string };
  ready: undefined;
  destroy: undefined;
}

// ─── Editing ──────────────────────────────────────────────

export interface EditState {
  rowIndex: number;
  columnId: string;
  value: CellValue;
  originalValue: CellValue;
}

export interface EditorDefinition {
  name: string;
  parse?: (raw: string) => CellValue;
  format?: (value: CellValue) => string;
}

// ─── Selection ────────────────────────────────────────────

/** A single cell coordinate. `row` is a view index; `col` is the column id. */
export interface CellCoord {
  row: number;
  col: string;
}

/**
 * A rectangular range of cells, normalized so `startRow ≤ endRow`. `startCol`
 * and `endCol` refer to column ids; the visual span covers every leaf column
 * between them in the current order (inclusive on both ends).
 *
 * `startCol` is positioned left of `endCol` in the column order *at the time
 * the range was created*. Because columns can be reordered at runtime, the
 * pair is not guaranteed to remain in left-to-right order forever — consumers
 * that need a deterministic visual span (e.g. clipboard, fill-handle) should
 * resolve both ids to current indices and treat them as an unordered pair.
 */
export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: string;
  endCol: string;
}

export interface SelectionState {
  readonly ranges: readonly CellRange[];
  /** Active cell — the most recently focused corner of the latest range. */
  readonly activeCell: Readonly<CellCoord> | null;
}

/**
 * How a header click or keyboard gesture should compose with the existing
 * selection. `replace` clears it, `add` adds a new range, `extend` reshapes
 * the most recent range from its anchor to the new corner.
 */
export type SelectionMode = 'replace' | 'add' | 'extend';

export interface SelectionPluginApi {
  getState(): SelectionState;
  /** Replace the entire selection with a single 1×1 range at `coord`. */
  selectCell(coord: CellCoord): void;
  /** Add a new 1×1 range and make it active (Ctrl/Cmd+click). */
  addCell(coord: CellCoord): void;
  /** Reshape the active range from its anchor to `coord` (Shift+click / drag). */
  extendTo(coord: CellCoord): void;
  /** Select an entire row by view index. */
  selectRow(rowIndex: number, mode?: SelectionMode): void;
  /** Select an entire column by id. */
  selectColumn(columnId: string, mode?: SelectionMode): void;
  /** Select all cells. */
  selectAll(): void;
  /** Clear all ranges and the active cell. */
  clear(): void;
  /** True if `(rowIndex, columnId)` falls within any range. */
  isCellSelected(rowIndex: number, columnId: string): boolean;
  /** True if `(rowIndex, columnId)` is the active cell. */
  isCellActive(rowIndex: number, columnId: string): boolean;
}

export interface EditingPluginApi {
  beginEdit(rowIndex: number, columnId: string, initialChar?: string): boolean;
  commitEdit(): boolean;
  cancelEdit(): void;
  getEditState(): EditState | null;
  isEditing(): boolean;
  defineEditor(def: EditorDefinition): void;
  getEditor(name: string): EditorDefinition | undefined;
  setValue(value: CellValue): void;
}

// ─── Clipboard ────────────────────────────────────────────

/** A 2-D matrix of cell values laid out as rows of columns. */
export type ClipboardMatrix = readonly (readonly CellValue[])[];

/** Dual-format clipboard payload written on copy/cut. */
export interface ClipboardPayload {
  /** Tab-separated values (Excel/Sheets interop format). */
  text: string;
  /** Minimal `<table>` HTML. Written for apps that prefer rich paste. */
  html: string;
}

export interface ClipboardPluginApi {
  /**
   * Serialize the active selection range and write TSV + HTML to the system
   * clipboard. Resolves `true` on success, `false` if there is nothing to
   * copy or the Clipboard API is unavailable/denied.
   */
  copy(): Promise<boolean>;
  /** Copy, then null-out the source cells. */
  cut(): Promise<boolean>;
  /** Read TSV/HTML from the system clipboard and paste at the active cell. */
  paste(): Promise<boolean>;
  /** Clear (set to null) every editable cell in the current selection. */
  deleteSelection(): boolean;
  /** Build a TSV+HTML payload for an arbitrary rectangular range. */
  serializeRange(range: CellRange): ClipboardPayload;
  /**
   * Parse a `{ text, html }` clipboard payload into a string matrix. Values
   * are returned as raw strings — type coercion happens in `applyMatrix`,
   * where the target column type is known. Returns null if nothing
   * parseable was provided.
   */
  parsePayload(payload: { text?: string; html?: string }): string[][] | null;
  /**
   * Write `matrix` into the grid starting at `(startRow, startCol)`. Values
   * are coerced per target column type. Out-of-bounds cells are skipped.
   */
  applyMatrix(matrix: ClipboardMatrix, startRow: number, startCol: string): void;
}

// ─── Fill Handle ──────────────────────────────────────────

/**
 * Recognizable series a source block can follow. `copy` is the fallback when
 * no other pattern fits — the seed values cycle unchanged.
 */
export type FillPatternKind =
  | 'copy'
  | 'arithmetic'
  | 'date-day'
  | 'day-name-short'
  | 'day-name-long'
  | 'month-name-short'
  | 'month-name-long'
  | 'custom-list'
  | 'prefix-number';

/** Direction of extrapolation relative to the seed block. */
export type FillDirection = 'forward' | 'reverse';

/** Detected pattern over a 1-D sequence of seed values. */
export interface FillPattern {
  kind: FillPatternKind;
  /** The original seed values, unchanged. */
  values: readonly CellValue[];
}

export interface FillOperation {
  /** The block of seed cells. */
  source: CellRange;
  /**
   * The rectangle after the drag. Must fully contain `source` and extend in
   * exactly one axis (rows OR columns), never both.
   */
  target: CellRange;
}

export interface FillHandlePluginOptions {
  /**
   * Case-insensitive cyclic lists the pattern detector will recognize
   * (e.g. `['Q1','Q2','Q3','Q4']`). Day/month name lists are built in and
   * do not need to be registered here.
   */
  customLists?: readonly (readonly string[])[];
}

export interface FillHandlePluginApi {
  /**
   * Apply a fill. Returns `true` when cells were written; `false` for degenerate
   * inputs (empty source, target not containing source, two-axis extension).
   */
  fill(op: FillOperation): boolean;
  /** Detect the pattern over a 1-D seed sequence. */
  inferPattern(values: readonly CellValue[]): FillPattern;
  /**
   * Extrapolate `count` values from a seed sequence. `forward` continues the
   * pattern past the end; `reverse` extends backward past the start.
   */
  generateValues(
    source: readonly CellValue[],
    count: number,
    direction: FillDirection,
  ): CellValue[];
  /** Add a custom cyclic list for the detector to recognize from now on. */
  registerCustomList(list: readonly string[]): void;
  /** Snapshot of every custom list currently registered (in registration order). */
  getCustomLists(): string[][];
}

// ─── History ──────────────────────────────────────────────

/**
 * A single undoable unit. `redo` re-applies the operation; `undo` reverses it.
 * Implementations should be idempotent under repeated execute/undo cycles and
 * must not record themselves into the history stack while running — the
 * history plugin handles suppression via an internal flag.
 */
export interface Command {
  redo(): void;
  undo(): void;
  /** Optional human-readable label for debugging/devtools. */
  readonly label?: string;
}

export interface HistoryPluginOptions {
  /** Maximum size of the undo stack (default 100). When exceeded, the oldest entry is dropped. */
  maxSize?: number;
}

export interface HistoryPluginApi {
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /**
   * Group multiple mutations into a single undoable command. Nested batches
   * are flattened — only the outermost batch produces a stack entry.
   */
  batch(fn: () => void): void;
  /** Push a custom command directly. Useful for plugins that own their own state. */
  push(command: Command): void;
  /** Clear both undo and redo stacks. */
  clear(): void;
  getUndoSize(): number;
  getRedoSize(): number;
  setMaxSize(size: number): void;
  /**
   * Run `fn` with history recording paused. Nested suppressions are refcounted
   * — the inner call returns control to the outer suppression without
   * resuming recording prematurely. Used by async data loaders to populate
   * cells without polluting the user's undo stack.
   */
  suppress<T>(fn: () => T): T;
}

// ─── Validation ───────────────────────────────────────────

/**
 * Outcome of a single validator. `true` means valid; any string is the error
 * message to surface. Using a plain string (rather than a rich object) keeps
 * the return type of most handwritten validators trivial to read.
 */
export type ValidationResult = true | string;

/** Context passed to validators at call-time. */
export interface ValidationContext {
  /** View-index at validation time. Use `dataIndex` for identity across sort/filter. */
  rowIndex: number;
  /** Stable data-index of the row (survives sort and filter). */
  dataIndex: number;
  columnId: string;
  /**
   * Snapshot of the row at validation time. Reflects the *committed* value of
   * each cell — the candidate value being validated is passed separately as
   * the validator's first argument, not via `row[columnId]`.
   */
  row: Row;
  /**
   * Value the cell held before the edit in progress. For revalidations not
   * triggered by an edit, equals the cell's current value.
   */
  originalValue: CellValue;
}

export type SyncValidator = (value: CellValue, ctx: ValidationContext) => ValidationResult;
export type AsyncValidator = (
  value: CellValue,
  ctx: ValidationContext,
) => Promise<ValidationResult>;

/** Determines whether a failing sync validator blocks the commit. */
export type ValidationMode = 'reject' | 'warn';

/**
 * `invalid` — a validator returned an error message. `pending` — an async
 * validator is still running for the cell (no resolved verdict yet).
 */
export type ValidationErrorState = 'invalid' | 'pending';

export interface ValidationError {
  /** Stable data-index of the row (not a view index). */
  dataIndex: number;
  columnId: string;
  /** Error message from the failing validator; empty string while pending. */
  message: string;
  value: CellValue;
  state: ValidationErrorState;
}

export interface ValidationPluginApi {
  /**
   * Run sync validation for the current (or supplied) value of a cell. The
   * internal error state and cell decoration are updated as a side-effect, and
   * `'validation:change'` is emitted when the verdict for the cell changes.
   * Async validators attached to the same column are kicked off in the
   * background; their resolution updates the error state asynchronously.
   */
  validateCell(rowIndex: number, columnId: string, value?: CellValue): ValidationResult;
  /**
   * Run sync + async validation and resolve with the async result (or the
   * sync failure, if sync failed). Cell is flagged `pending` while running.
   */
  validateCellAsync(
    rowIndex: number,
    columnId: string,
    value?: CellValue,
  ): Promise<ValidationResult>;
  /** Validate every cell that has at least one validator. Resolves with the final error set. */
  validateAll(): Promise<readonly ValidationError[]>;
  /** Current error/pending record for a view-cell, or `null` if valid. */
  getError(rowIndex: number, columnId: string): ValidationError | null;
  /** `true` if an async validation is still in flight for the cell. */
  isPending(rowIndex: number, columnId: string): boolean;
  /** Snapshot of every current error (invalid or pending). */
  getErrors(): readonly ValidationError[];
  /**
   * Drop recorded errors. Scope is selected by which args are passed:
   * - `()` — clear everything.
   * - `(rowIndex)` — clear every error on that row.
   * - `(undefined, columnId)` — clear every error on that column.
   * - `(rowIndex, columnId)` — clear a single cell.
   */
  clearErrors(rowIndex?: number, columnId?: string): void;
}

// ─── Async Data Source ────────────────────────────────────

/**
 * Parameters for a row-window fetch. `start` is inclusive, `end` is exclusive —
 * `[start, end)` matches the idiomatic JS slice range. When `sort` or `filter`
 * is omitted the source should return rows in its natural order.
 *
 * `signal` lets the caller cancel a stale fetch when the plugin invalidates
 * (e.g. the user changed sort mid-flight). Sources that honor the signal can
 * avoid wasted server work.
 */
export interface AsyncDataSourceParams {
  start: number;
  end: number;
  sort?: SortState;
  filter?: FilterState;
  signal?: AbortSignal;
}

/** Arguments for `getRowCount` — only sort/filter can change the total. */
export interface AsyncDataSourceCountParams {
  sort?: SortState;
  filter?: FilterState;
  signal?: AbortSignal;
}

/**
 * Data source contract for server-backed grids. Implementations must return
 * `[start, end)` rows for `getRows` — fewer rows are permitted only when the
 * window runs past the end of the dataset. `getRowCount` reports the total
 * rows the server would return under the given filter (sort doesn't affect
 * total, but is passed so implementations can cache per-query).
 */
export interface AsyncDataSource {
  getRows(params: AsyncDataSourceParams): Promise<readonly Row[]>;
  getRowCount(params?: AsyncDataSourceCountParams): Promise<number>;
}

export interface AsyncDataPluginOptions {
  source: AsyncDataSource;
  /**
   * Rows per fetch window. Ranges requested via `loadRange` are rounded out
   * to full page boundaries so repeated scrolls through the same region don't
   * issue overlapping fetches. Default 100.
   */
  pageSize?: number;
  /**
   * When true (default), `sort:change` invalidates the cache and refetches
   * with the new sort. When false, the source is expected to be server-sorted
   * once at init and client-side sort is applied to the loaded window.
   */
  serverSideSort?: boolean;
  /**
   * When true (default), `filter:change` invalidates the cache, re-fetches
   * the total count, and refetches with the new filter.
   */
  serverSideFilter?: boolean;
}

export interface AsyncDataPluginApi {
  /**
   * Ensure rows in the given view-range are loaded. `start` and `endInclusive`
   * are view indices; the plugin resolves them to data indices and fetches
   * any pages that contain unloaded rows. No-op for fully-loaded ranges.
   */
  loadRange(start: number, endInclusive: number): Promise<void>;
  /**
   * Invalidate the cache, re-fetch row count, and reset to placeholders.
   * Typically called after the underlying dataset changes on the server.
   */
  refresh(): Promise<void>;
  /** Total row count last reported by the server. */
  getTotalCount(): number;
  /** True if every cell in the row has been loaded. */
  isRowLoaded(dataIndex: number): boolean;
  /** True while any fetch is in flight. */
  isLoading(): boolean;
}

// ─── Plugin ────────────────────────────────────────────────

export interface CellDecoration {
  className?: string;
  style?: Record<string, string>;
  attributes?: Record<string, string>;
}

export type CellDecorator = (cell: {
  row: number;
  col: string;
  value: CellValue;
}) => CellDecoration | null;

export interface PluginContext {
  grid: GridInstance;
  events: EventBus<GridEvents>;
  getPlugin<T>(name: string): T | undefined;
  expose(name: string, api: unknown): void;
  addCellDecorator(decorator: CellDecorator): void;
}

export interface GridPlugin {
  name: string;
  dependencies?: string[];
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  init(ctx: PluginContext): (() => void) | void;
}

// ─── Grid Options ──────────────────────────────────────────

export interface GridOptions {
  data: Row[];
  columns: ColumnDef[];
  plugins?: GridPlugin[];
  /** Indices (into `data`) of rows pinned to the top. */
  pinnedTopRows?: number[];
  /** Indices (into `data`) of rows pinned to the bottom. */
  pinnedBottomRows?: number[];
}

// ─── Grid Instance ─────────────────────────────────────────

export interface GridInstance {
  // State access
  readonly data: Row[];
  /** Flat array of leaf columns. Used for all data operations (sort, filter, edit). */
  readonly columns: ReadonlySignal<ColumnDef[]>;
  /**
   * Original column tree as provided by the caller (with `children` preserved).
   * Used exclusively by header renderers. For flat column configs this is
   * equivalent to `columns`.
   */
  readonly columnDefs: ReadonlySignal<ColumnDef[]>;
  readonly sortState: Signal<SortState>;
  readonly filterState: Signal<FilterState>;
  readonly indexMap: Computed<IndexMap>;

  // Cell operations
  getCell(rowIndex: number, columnId: string): CellValue;
  setCell(rowIndex: number, columnId: string, value: CellValue): void;
  /**
   * Write a cell by its underlying data index, bypassing the sort/filter view.
   * Used by undo/redo so a value can be restored even if the row is currently
   * filtered out. Emits the same `data:change` event as `setCell`.
   */
  setCellByDataIndex(dataIndex: number, columnId: string, value: CellValue): void;

  // Data operations
  setData(data: Row[]): void;
  setColumns(columns: ColumnDef[]): void;

  // Column operations
  resizeColumn(columnId: string, width: number): void;
  reorderColumn(fromIndex: number, toIndex: number): void;

  // Batch updates
  batchUpdate(fn: () => void): void;

  // Events
  readonly events: EventBus<GridEvents>;

  // Plugin access
  getPlugin<T>(name: string): T | undefined;

  // Cell decorators
  getCellDecorations(row: number, col: string): CellDecoration[];

  // Pinned rows
  readonly pinnedTopRows: ReadonlySignal<number[]>;
  readonly pinnedBottomRows: ReadonlySignal<number[]>;
  setPinnedTopRows(indices: number[]): void;
  setPinnedBottomRows(indices: number[]): void;

  // Row count (view)
  readonly rowCount: number;

  // Lifecycle
  destroy(): void;

  // Subscribe helper
  subscribe<K extends keyof GridEvents & string>(
    event: K,
    handler: (payload: GridEvents[K]) => void,
  ): Unsubscribe;
}
