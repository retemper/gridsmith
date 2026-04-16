// Components
export { Grid } from './grid';

// Hooks
export { useGrid } from './use-grid';
export type { UseGridOptions } from './use-grid';
export { useSignalValue } from './use-signal';
export { useGridSelection } from './use-grid-selection';
export type { SelectionState } from './use-grid-selection';

// Types
export type { GridProps, GridColumnDef, CellRendererProps, CellEditorProps } from './types';

// Re-export core types commonly needed with the React adapter
export {
  type CellValue,
  type Row,
  type ColumnDef,
  type ColumnType,
  type SelectOption,
  type SortState,
  type SortEntry,
  type SortDirection,
  type FilterState,
  type FilterEntry,
  type FilterOperator,
  type CellChange,
  type EditState,
  type EditorDefinition,
  type EditingPluginApi,
  type GridInstance,
  type GridPlugin,
  type GridOptions,
  createEditingPlugin,
  VERSION,
} from '@gridsmith/core';
