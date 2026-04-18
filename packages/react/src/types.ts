import type {
  CellChange,
  CellValue,
  ColumnDef,
  FilterState,
  GridPlugin,
  Row,
  SortState,
} from '@gridsmith/core';
import type { ReactNode } from 'react';

/** Props passed to custom cell renderer components. */
export interface CellRendererProps {
  value: CellValue;
  row: Row;
  rowIndex: number;
  column: GridColumnDef;
}

/** Props passed to custom cell editor components. */
export interface CellEditorProps {
  value: CellValue;
  row: Row;
  rowIndex: number;
  column: GridColumnDef;
  commit: (value: CellValue) => void;
  cancel: () => void;
}

/** Extended column definition with React-specific fields. */
export interface GridColumnDef extends Omit<ColumnDef, 'children'> {
  cellRenderer?: (props: CellRendererProps) => ReactNode;
  /** Custom React editor component for this column. */
  cellEditor?: (props: CellEditorProps) => ReactNode;
  /**
   * Nested child column definitions. Setting this makes the entry a header
   * group that spans its children's columns and carries no data.
   */
  children?: GridColumnDef[];
}

/** Props for the Grid component. */
export interface GridProps {
  data: Row[];
  columns: GridColumnDef[];
  plugins?: GridPlugin[];

  /** Fixed row height in pixels (default: 32) */
  rowHeight?: number;
  /** Header height in pixels (default: rowHeight) */
  headerHeight?: number;
  /** Extra rows/columns to render outside viewport (default: 3) */
  overscan?: number;
  /** Default column width when not specified (default: 100) */
  defaultColumnWidth?: number;
  /** CSS class name for the root element */
  className?: string;

  /** Controlled sort state */
  sortState?: SortState;
  /** Controlled filter state */
  filterState?: FilterState;

  /** Data-index rows pinned to the top */
  pinnedTopRows?: number[];
  /** Data-index rows pinned to the bottom */
  pinnedBottomRows?: number[];

  /** Called when a cell value changes */
  onCellChange?: (change: CellChange) => void;
  /** Called when sort state changes */
  onSortChange?: (sort: SortState) => void;
  /** Called when filter state changes */
  onFilterChange?: (filter: FilterState) => void;
  /** Called when a column is resized */
  onColumnResize?: (columnId: string, width: number) => void;
  /** Called when a column is reordered */
  onColumnReorder?: (columnId: string, fromIndex: number, toIndex: number) => void;
}
