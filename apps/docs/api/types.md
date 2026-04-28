# Types

The exported type surface. Source of truth: [`packages/core/src/types.ts`](https://github.com/retemper/gridsmith/blob/main/packages/core/src/types.ts).

## Cell values & rows

```ts
type CellValue = string | number | boolean | Date | null | undefined;

type Row = Record<string, CellValue>;
```

Gridsmith stores rows as plain objects keyed by `ColumnDef.id`.

## ColumnDef

```ts
interface ColumnDef {
  id: string; // required — unique row key
  header: string; // required — display label

  width?: number;
  minWidth?: number;
  maxWidth?: number;

  type?: ColumnType; // 'text' | 'number' | 'date' | 'select' | 'checkbox'
  pin?: PinPosition; // 'left' | 'right' | false
  visible?: boolean; // default true

  sortable?: boolean; // default true
  filterable?: boolean; // default true
  resizable?: boolean; // default true
  editable?: boolean; // default true

  editor?: string; // editor name (built-in or custom)
  selectOptions?: SelectOption[]; // for type: 'select'

  comparator?: CellComparator;
  validate?: SyncValidator;
  asyncValidate?: AsyncValidator;
  validationMode?: 'reject' | 'warn'; // default 'reject'

  children?: ColumnDef[]; // makes this a header group
}

interface SelectOption {
  label: string;
  value: CellValue;
}
```

The React-extended version (`GridColumnDef`) adds `cellRenderer` and `cellEditor`.

## Sort / filter state

```ts
type SortState = SortEntry[];

interface SortEntry {
  columnId: string;
  direction: SortDirection; // 'asc' | 'desc'
  comparator?: CellComparator; // overrides ColumnDef.comparator
}

type FilterState = FilterEntry[];

interface FilterEntry {
  columnId: string;
  operator: FilterOperator;
  value: FilterValue;
}

type FilterOperator =
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

type FilterValue = CellValue | readonly CellValue[] | RegExp;

type CellComparator = (a: CellValue, b: CellValue) => number;
```

## Selection

`CellCoord.col` and `CellRange.startCol`/`endCol` carry **column ids** (strings), not indices. `row` is a view-row index.

```ts
interface CellCoord {
  row: number; // view-row index
  col: string; // column id
}

interface CellRange {
  startRow: number;
  endRow: number;
  startCol: string; // column id
  endCol: string; // column id
}

interface SelectionState {
  readonly ranges: readonly CellRange[];
  readonly activeCell: Readonly<CellCoord> | null;
}

type SelectionMode = 'replace' | 'add' | 'extend';

interface SelectionPluginApi {
  getState(): SelectionState;
  selectCell(coord: CellCoord): void;
  addCell(coord: CellCoord): void;
  extendTo(coord: CellCoord): void;
  selectRow(rowIndex: number, mode?: SelectionMode): void;
  selectColumn(columnId: string, mode?: SelectionMode): void;
  selectAll(): void;
  clear(): void;
  isCellSelected(rowIndex: number, columnId: string): boolean;
  isCellActive(rowIndex: number, columnId: string): boolean;
}
```

## Editing

```ts
interface EditState {
  rowIndex: number;
  columnId: string;
  value: CellValue; // current draft value
  originalValue: CellValue; // pre-edit value, restored on cancel
}

interface EditorDefinition {
  name: string;
  parse?: (raw: string) => CellValue;
  format?: (value: CellValue) => string;
}

interface EditingPluginApi {
  beginEdit(rowIndex: number, columnId: string, initialChar?: string): boolean;
  commitEdit(): boolean;
  cancelEdit(): void;
  getEditState(): EditState | null;
  isEditing(): boolean;
  defineEditor(def: EditorDefinition): void;
  getEditor(name: string): EditorDefinition | undefined;
  setValue(value: CellValue): void;
}
```

## Clipboard

```ts
type ClipboardMatrix = CellValue[][];

interface ClipboardPayload {
  text: string; // TSV
  html: string; // <table>
}

interface ClipboardPluginApi {
  copy(): Promise<boolean>;
  cut(): Promise<boolean>;
  paste(): Promise<boolean>;
  deleteSelection(): boolean;
  serializeRange(range: CellRange): ClipboardPayload;
  parsePayload(input: string): ClipboardMatrix;
  applyMatrix(matrix: ClipboardMatrix, target: CellCoord): void;
}
```

All async methods resolve `false` when the operation is a no-op (nothing selected, clipboard API unavailable/denied) instead of throwing.

## History

```ts
interface Command {
  redo(): void;
  undo(): void;
  readonly label?: string; // optional, debugging only
}

interface HistoryPluginApi {
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch(fn: () => void): void;
  push(command: Command): void;
  clear(): void;
  getUndoSize(): number;
  getRedoSize(): number;
  setMaxSize(size: number): void;
  suppress<T>(fn: () => T): T;
}

interface HistoryPluginOptions {
  maxSize?: number; // default 100
}
```

`undo` / `redo` return `false` when the corresponding stack is empty.

## Fill handle

```ts
type FillPatternKind =
  | 'arithmetic'
  | 'date'
  | 'day-name-short'
  | 'day-name-long'
  | 'month-name-short'
  | 'month-name-long'
  | 'prefix-number'
  | 'custom-list'
  | 'copy';

type FillDirection = 'forward' | 'reverse';

interface FillPattern {
  kind: FillPatternKind;
  // discriminated payload per kind
}

interface FillOperation {
  source: CellRange;
  target: CellRange;
}

interface FillHandlePluginOptions {
  customLists?: readonly (readonly string[])[];
}

interface FillHandlePluginApi {
  fill(op: FillOperation): boolean;
  inferPattern(values: readonly CellValue[]): FillPattern;
  generateValues(
    source: readonly CellValue[],
    count: number,
    direction: FillDirection,
  ): CellValue[];
  registerCustomList(list: readonly string[]): void;
  getCustomLists(): string[][];
}
```

`fill` returns `false` for degenerate inputs (empty source, target not enclosing source, two-axis extension).

## Validation

```ts
type ValidationResult = true | string;

interface ValidationContext {
  rowIndex: number; // view index at validation time
  dataIndex: number; // stable, survives sort/filter
  columnId: string;
  row: Row; // snapshot of committed row values
}

type SyncValidator = (value: CellValue, ctx: ValidationContext) => ValidationResult;
type AsyncValidator = (value: CellValue, ctx: ValidationContext) => Promise<ValidationResult>;

type ValidationMode = 'reject' | 'warn';

type ValidationErrorState = 'invalid' | 'validating' | 'valid';

interface ValidationError {
  dataIndex: number; // stable row index
  columnId: string;
  message: string; // empty string while pending
  value: CellValue;
  state: ValidationErrorState;
}

interface ValidationPluginApi {
  validateCell(rowIndex: number, columnId: string, value?: CellValue): ValidationResult;
  validateCellAsync(
    rowIndex: number,
    columnId: string,
    value?: CellValue,
  ): Promise<ValidationResult>;
  validateAll(): readonly ValidationError[];
  getErrors(): readonly ValidationError[];
  getError(rowIndex: number, columnId: string): ValidationError | null;
  isPending(rowIndex: number, columnId: string): boolean;
  clearErrors(rowIndex?: number, columnId?: string): void;
}
```

`ValidationError` is keyed by `dataIndex` — the view-row may shift under sort/filter, but the error follows the underlying row.

## Change tracking

```ts
interface CellChange {
  row: number; // see note below
  col: string; // column id
  oldValue: CellValue;
  newValue: CellValue;
}

interface ChangesPluginApi {
  getDirty(): CellChange[];
  isDirty(rowIndex: number, columnId: string): boolean;
  commit(): void;
  revert(): void;
}
```

In events (`data:change`, `changes:update`), `CellChange.row` is interpreted by the source — for plain `setCell` it's a view-row; for `getDirty()` it's a **data-row** (stable across sort/filter). Use `grid.indexMap.get().dataToView(row)` to project a dirty entry to the current view.

## Async data

```ts
interface AsyncDataSourceParams {
  start: number;
  end: number;
  sort?: SortState;
  filter?: FilterState;
  signal?: AbortSignal;
}

interface AsyncDataSourceCountParams {
  sort?: SortState;
  filter?: FilterState;
  signal?: AbortSignal;
}

interface AsyncDataSource {
  getRows(params: AsyncDataSourceParams): Promise<Row[]>;
  getRowCount(params?: AsyncDataSourceCountParams): Promise<number>;
}

interface AsyncDataPluginOptions {
  source: AsyncDataSource;
  pageSize?: number; // default 100
  serverSideSort?: boolean;
  serverSideFilter?: boolean;
}

interface AsyncDataPluginApi {
  loadRange(start: number, endInclusive: number): Promise<void>;
  refresh(): Promise<void>;
  getTotalCount(): number;
  isRowLoaded(idx: number): boolean;
  isLoading(): boolean;
}
```

## Plugins

```ts
interface CellDecoration {
  className?: string;
  attributes?: Record<string, string>;
}

interface CellDecorator {
  (input: { rowIndex: number; columnId: string; row: Row }): CellDecoration | null;
}

interface PluginContext {
  grid: GridInstance;
  events: EventBus<GridEvents>;
  getPlugin<T>(name: string): T | undefined;
  expose(name: string, api: object): void;
  addCellDecorator(decorator: CellDecorator): void;
}

interface GridPlugin {
  name: string;
  dependencies?: string[];
  init(ctx: PluginContext): (() => void) | void;
}
```

## Index map / virtualization

```ts
interface IndexMap {
  viewToData(viewIndex: number): number;
  dataToView(dataIndex: number): number | null;
  readonly length: number;
}

interface ViewportState {
  scrollTop: number;
  scrollLeft: number;
  containerWidth: number;
  containerHeight: number;
}

interface VisibleRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}
```

## Pinning

```ts
type PinPosition = 'left' | 'right' | false;
type ColumnType = 'text' | 'number' | 'date' | 'select' | 'checkbox';
```

## Source

The canonical source is [`packages/core/src/types.ts`](https://github.com/retemper/gridsmith/blob/main/packages/core/src/types.ts) — if these tables and the source ever drift, the source wins.
