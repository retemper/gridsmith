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
  readonly columns: ReadonlySignal<ColumnDef[]>;
  readonly sortState: Signal<SortState>;
  readonly filterState: Signal<FilterState>;
  readonly indexMap: Computed<IndexMap>;

  // Cell operations
  getCell(rowIndex: number, columnId: string): CellValue;
  setCell(rowIndex: number, columnId: string, value: CellValue): void;

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
