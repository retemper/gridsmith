import type { VisibleRange, ColumnDef } from './types';

// ─── Virtualization Config ────────────────────────────────

export interface VirtualizationConfig {
  /** Fixed row height in pixels */
  rowHeight: number;
  /** Number of extra rows/columns to render outside viewport */
  overscan: number;
  /** Default column width when ColumnDef.width is not set */
  defaultColumnWidth: number;
}

export const DEFAULT_CONFIG: VirtualizationConfig = {
  rowHeight: 32,
  overscan: 3,
  defaultColumnWidth: 100,
};

// ─── Column Layout ────────────────────────────────────────

export interface ColumnLayout {
  /** Left offset of each column in pixels */
  offsets: number[];
  /** Resolved width of each column in pixels */
  widths: number[];
  /** Total width of all columns */
  totalWidth: number;
}

export function computeColumnLayout(columns: ColumnDef[], defaultWidth: number): ColumnLayout {
  const widths: number[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const col of columns) {
    const w = col.visible === false ? 0 : (col.width ?? defaultWidth);
    offsets.push(offset);
    widths.push(w);
    offset += w;
  }

  return { offsets, widths, totalWidth: offset };
}

// ─── Visible Range Calculation ────────────────────────────

export function calculateVisibleRange(
  scrollTop: number,
  scrollLeft: number,
  viewportWidth: number,
  viewportHeight: number,
  totalRows: number,
  columnLayout: ColumnLayout,
  config: VirtualizationConfig,
): VisibleRange {
  const { rowHeight, overscan } = config;
  const totalCols = columnLayout.offsets.length;

  // Empty grid → empty range
  if (totalRows === 0 || totalCols === 0) {
    return { rowStart: 0, rowEnd: -1, colStart: 0, colEnd: -1 };
  }

  // ─── Rows (fixed height → O(1)) ────────────────────────
  const rawRowStart = Math.floor(scrollTop / rowHeight);
  const visibleRowCount = Math.ceil(viewportHeight / rowHeight);
  const rowStart = Math.max(0, rawRowStart - overscan);
  const rowEnd = Math.min(totalRows - 1, rawRowStart + visibleRowCount + overscan);

  // ─── Columns (variable width → binary search) ──────────
  const { offsets, widths } = columnLayout;

  let colStart = binarySearchOffset(offsets, scrollLeft);
  colStart = Math.max(0, colStart - overscan);

  const scrollRight = scrollLeft + viewportWidth;
  let colEnd = binarySearchOffset(offsets, scrollRight);
  // Ensure we include the column that contains scrollRight
  if (colEnd < totalCols - 1 && offsets[colEnd] + widths[colEnd] < scrollRight) {
    colEnd++;
  }
  colEnd = Math.min(totalCols - 1, colEnd + overscan);

  // Skip hidden columns at boundaries
  while (colStart < colEnd && widths[colStart] === 0) colStart++;
  while (colEnd > colStart && widths[colEnd] === 0) colEnd--;

  return { rowStart, rowEnd, colStart, colEnd };
}

/**
 * Binary search for the index of the column whose offset is <= target.
 * Returns the index of the last column whose left edge is at or before `target`.
 */
function binarySearchOffset(offsets: number[], target: number): number {
  let lo = 0;
  let hi = offsets.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (offsets[mid] <= target) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

// ─── Total Content Height ─────────────────────────────────

export function getTotalHeight(totalRows: number, rowHeight: number): number {
  return totalRows * rowHeight;
}
