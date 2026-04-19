// Components
export { Grid } from './grid';

// Hooks
export { useGrid } from './use-grid';
export type { UseGridOptions } from './use-grid';
export { useSignalValue } from './use-signal';
export { useGridSelection } from './use-grid-selection';
export type { SelectionState } from './use-grid-selection';
export { useGridClipboard } from './use-grid-clipboard';
export { useGridFillHandle } from './use-grid-fill-handle';
export { useGridValidation } from './use-grid-validation';

// Types
export type { GridProps, GridColumnDef, CellRendererProps, CellEditorProps } from './types';

// Re-export core types commonly needed with the React adapter
export {
  type CellValue,
  type Row,
  type ColumnDef,
  type ColumnType,
  type PinPosition,
  type SelectOption,
  type SortState,
  type SortEntry,
  type SortDirection,
  type CellComparator,
  type FilterState,
  type FilterEntry,
  type FilterOperator,
  type FilterValue,
  type CellChange,
  type EditState,
  type EditorDefinition,
  type EditingPluginApi,
  type GridInstance,
  type GridPlugin,
  type GridOptions,
  type HeaderCell,
  type ClipboardPluginApi,
  type ClipboardPayload,
  type ClipboardMatrix,
  type Command,
  type HistoryPluginApi,
  type HistoryPluginOptions,
  type FillPatternKind,
  type FillDirection,
  type FillPattern,
  type FillOperation,
  type FillHandlePluginOptions,
  type FillHandlePluginApi,
  type ValidationResult,
  type ValidationContext,
  type ValidationMode,
  type ValidationErrorState,
  type ValidationError,
  type ValidationPluginApi,
  type SyncValidator,
  type AsyncValidator,
  type AsyncDataSource,
  type AsyncDataSourceParams,
  type AsyncDataSourceCountParams,
  type AsyncDataPluginOptions,
  type AsyncDataPluginApi,
  createAsyncDataPlugin,
  createClipboardPlugin,
  createEditingPlugin,
  createFillHandlePlugin,
  createHistoryPlugin,
  createValidationPlugin,
  flattenColumns,
  getHeaderDepth,
  buildHeaderRows,
  columnStructureKey,
  VERSION,
} from '@gridsmith/core';
