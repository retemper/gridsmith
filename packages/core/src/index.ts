export const VERSION = '0.0.0';

// Core API
export { createGrid } from './grid';
export { createRenderer } from './renderer';
export type { RendererOptions, RendererInstance } from './renderer';

// Virtualization
export {
  computeColumnLayout,
  calculateVisibleRange,
  getTotalHeight,
  DEFAULT_CONFIG,
} from './virtualization';
export type { VirtualizationConfig, ColumnLayout } from './virtualization';

// Reactive primitives
export { signal, computed, batch } from './signal';
export type { Signal, Computed, ReadonlySignal, Unsubscribe } from './signal';

// Event bus
export { createEventBus } from './events';
export type { EventBus, EventHandler } from './events';

// Editing
export { createEditingPlugin } from './editing';

// Selection
export { createSelectionPlugin } from './selection';

// Clipboard
export { createClipboardPlugin } from './clipboard';

// History
export { createHistoryPlugin } from './history';

// Fill Handle
export { createFillHandlePlugin } from './fill-handle';

// Validation
export { createValidationPlugin } from './validation';

// Async data source
export { createAsyncDataPlugin } from './async-data';

// Change tracking
export { createChangesPlugin } from './changes';

// Column grouping
export {
  flattenColumns,
  getHeaderDepth,
  buildHeaderRows,
  setLeafWidth,
  columnStructureKey,
} from './column-group';
export type { HeaderCell } from './column-group';

// ARIA helpers
export {
  buildCellId,
  buildPinnedCellId,
  computeRowCount,
  createAnnouncer,
  dataRowAriaIndex,
  headerRowAriaIndex,
  nextGridInstanceId,
  pinnedBottomAriaIndex,
  pinnedTopAriaIndex,
} from './aria';
export type { Announcer, AriaRowCountInput } from './aria';

// Types
export type {
  CellValue,
  Row,
  ColumnType,
  PinPosition,
  SelectOption,
  ColumnDef,
  SortDirection,
  SortEntry,
  SortState,
  CellComparator,
  FilterEntry,
  FilterOperator,
  FilterState,
  FilterValue,
  IndexMap,
  ViewportState,
  VisibleRange,
  CellChange,
  GridEvents,
  EditState,
  EditorDefinition,
  EditingPluginApi,
  CellCoord,
  CellRange,
  SelectionState,
  SelectionMode,
  SelectionPluginApi,
  ClipboardPayload,
  ClipboardMatrix,
  ClipboardPluginApi,
  Command,
  HistoryPluginApi,
  HistoryPluginOptions,
  FillPatternKind,
  FillDirection,
  FillPattern,
  FillOperation,
  FillHandlePluginOptions,
  FillHandlePluginApi,
  ValidationResult,
  ValidationContext,
  ValidationMode,
  ValidationErrorState,
  ValidationError,
  ValidationPluginApi,
  SyncValidator,
  AsyncValidator,
  ChangesPluginApi,
  AsyncDataSource,
  AsyncDataSourceParams,
  AsyncDataSourceCountParams,
  AsyncDataPluginOptions,
  AsyncDataPluginApi,
  CellDecoration,
  CellDecorator,
  PluginContext,
  GridPlugin,
  GridOptions,
  GridInstance,
} from './types';
