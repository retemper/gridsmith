import type { EventBus } from './events';
import type { Signal, Computed, ReadonlySignal, Unsubscribe } from './signal';

// ─── Cell & Data ───────────────────────────────────────────

export type CellValue = string | number | boolean | Date | null | undefined;

export type Row = Record<string, CellValue>;

// ─── Column Definition ─────────────────────────────────────

export type ColumnType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

export type PinPosition = 'left' | 'right' | false;

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
}

// ─── Sort & Filter ─────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortEntry {
  columnId: string;
  direction: SortDirection;
}

export type SortState = SortEntry[];

export interface FilterEntry {
  columnId: string;
  operator: FilterOperator;
  value: CellValue;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

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
  'plugin:ready': { name: string };
  ready: undefined;
  destroy: undefined;
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

  // Batch updates
  batchUpdate(fn: () => void): void;

  // Events
  readonly events: EventBus<GridEvents>;

  // Plugin access
  getPlugin<T>(name: string): T | undefined;

  // Cell decorators
  getCellDecorations(row: number, col: string): CellDecoration[];

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
