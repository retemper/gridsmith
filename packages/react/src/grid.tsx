import {
  type CellValue,
  type GridInstance,
  type Row,
  type VisibleRange,
  calculateVisibleRange,
  computeColumnLayout,
  getTotalHeight,
  DEFAULT_CONFIG,
} from '@gridsmith/core';
import {
  type CSSProperties,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { GridProps } from './types';
import { useGrid } from './use-grid';
import { useSignalValue } from './use-signal';

// ─── Helpers ───────────────────────────────────────────────

function formatCellValue(value: CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function rangeEqual(a: VisibleRange | null, b: VisibleRange): boolean {
  return (
    a !== null &&
    a.rowStart === b.rowStart &&
    a.rowEnd === b.rowEnd &&
    a.colStart === b.colStart &&
    a.colEnd === b.colEnd
  );
}

function buildRowData(grid: GridInstance, viewIndex: number, columnIds: string[]): Row {
  const row: Row = {};
  for (const id of columnIds) {
    row[id] = grid.getCell(viewIndex, id);
  }
  return row;
}

// ─── Grid Component ────────────────────────────────────────

export const Grid = memo(function Grid({
  data,
  columns,
  plugins,
  rowHeight = DEFAULT_CONFIG.rowHeight,
  headerHeight: headerHeightProp,
  overscan = DEFAULT_CONFIG.overscan,
  defaultColumnWidth = DEFAULT_CONFIG.defaultColumnWidth,
  className,
  sortState: controlledSort,
  filterState: controlledFilter,
  onCellChange,
  onSortChange,
  onFilterChange,
}: GridProps) {
  const headerHeight = headerHeightProp ?? rowHeight;
  const grid = useGrid({ data, columns, plugins });

  // ─── Controlled state sync ─────────────────────────────

  const prevSortRef = useRef<typeof controlledSort>(undefined);
  useEffect(() => {
    if (controlledSort === undefined || controlledSort === prevSortRef.current) return;
    prevSortRef.current = controlledSort;
    grid.sortState.set(controlledSort);
  }, [controlledSort, grid]);

  const prevFilterRef = useRef<typeof controlledFilter>(undefined);
  useEffect(() => {
    if (controlledFilter === undefined || controlledFilter === prevFilterRef.current) return;
    prevFilterRef.current = controlledFilter;
    grid.filterState.set(controlledFilter);
  }, [controlledFilter, grid]);

  // ─── Event callbacks ───────────────────────────────────

  useEffect(() => {
    if (!onCellChange) return;
    return grid.subscribe('data:change', ({ changes }) => {
      for (const c of changes) onCellChange(c);
    });
  }, [grid, onCellChange]);

  useEffect(() => {
    if (!onSortChange) return;
    return grid.subscribe('sort:change', ({ sort }) => onSortChange(sort));
  }, [grid, onSortChange]);

  useEffect(() => {
    if (!onFilterChange) return;
    return grid.subscribe('filter:change', ({ filter }) => onFilterChange(filter));
  }, [grid, onFilterChange]);

  // ─── Reactive state from core ──────────────────────────

  const currentColumns = useSignalValue(grid.columns);
  const indexMap = useSignalValue(grid.indexMap);
  const totalRows = indexMap.length;

  // Data version counter — triggers row re-render on cell/data changes
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const unsubs = [
      grid.subscribe('data:change', () => setDataVersion((v) => v + 1)),
      grid.subscribe('data:rowsUpdate', () => setDataVersion((v) => v + 1)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [grid]);

  // ─── Layout computation ────────────────────────────────

  const columnLayout = useMemo(
    () => computeColumnLayout(currentColumns, defaultColumnWidth),
    [currentColumns, defaultColumnWidth],
  );

  const totalHeight = getTotalHeight(totalRows, rowHeight);

  const columnIds = useMemo(() => currentColumns.map((c) => c.id), [currentColumns]);

  // ─── Viewport & visible range ──────────────────────────

  const viewportRef = useRef<HTMLDivElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange | null>(null);

  // Refs for latest values so the scroll handler never goes stale
  const stateRef = useRef({
    totalRows,
    columnLayout,
    rowHeight,
    overscan,
    defaultColumnWidth,
  });
  stateRef.current = {
    totalRows,
    columnLayout,
    rowHeight,
    overscan,
    defaultColumnWidth,
  };

  const updateRange = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const {
      totalRows: tr,
      columnLayout: cl,
      rowHeight: rh,
      overscan: os,
      defaultColumnWidth: dcw,
    } = stateRef.current;

    if (el.clientWidth === 0 || el.clientHeight === 0 || tr === 0) {
      setVisibleRange(null);
      return;
    }

    const range = calculateVisibleRange(
      el.scrollTop,
      el.scrollLeft,
      el.clientWidth,
      el.clientHeight,
      tr,
      cl,
      { rowHeight: rh, overscan: os, defaultColumnWidth: dcw },
    );

    // Sync header scroll via direct DOM mutation to avoid per-frame re-renders
    if (headerInnerRef.current) {
      headerInnerRef.current.style.transform = `translateX(-${el.scrollLeft}px)`;
    }
    setVisibleRange((prev) => (rangeEqual(prev, range) ? prev : range));
  }, []);

  // Attach scroll + resize listeners once
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onScroll = () => updateRange();
    el.addEventListener('scroll', onScroll, { passive: true });

    const observer = new ResizeObserver(() => updateRange());
    observer.observe(el);

    updateRange();

    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [updateRange]);

  // Re-compute range when row count or column layout changes
  useEffect(() => {
    updateRange();
  }, [totalRows, columnLayout, updateRange]);

  // ─── Render header ─────────────────────────────────────

  const headerCells = useMemo(
    () =>
      currentColumns.map((col, i) => {
        if (col.visible === false) return null;
        return (
          <div
            key={col.id}
            className="gs-header-cell"
            style={{
              position: 'absolute',
              left: columnLayout.offsets[i],
              width: columnLayout.widths[i],
              height: headerHeight,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {col.header}
          </div>
        );
      }),
    [currentColumns, columnLayout, headerHeight],
  );

  // ─── Render rows ───────────────────────────────────────

  const rowElements = useMemo(() => {
    if (!visibleRange || totalRows === 0) return null;

    // read dataVersion to re-run when data changes
    void dataVersion;

    // Clamp row range to current totalRows — the visible range may be stale
    // when a filter/sort effect has updated the indexMap but the range effect
    // has not yet re-fired.
    const rowEnd = Math.min(visibleRange.rowEnd, totalRows - 1);
    if (visibleRange.rowStart > rowEnd) return null;

    const result: ReactNode[] = [];

    for (let r = visibleRange.rowStart; r <= rowEnd; r++) {
      const cells: ReactNode[] = [];
      let rowData: Row | null = null;

      for (let c = visibleRange.colStart; c <= visibleRange.colEnd; c++) {
        const col = columns[c];
        if (!col || col.visible === false) continue;

        const value = grid.getCell(r, col.id);

        let content: ReactNode;
        if (col.cellRenderer) {
          rowData ??= buildRowData(grid, r, columnIds);
          content = col.cellRenderer({ value, row: rowData, rowIndex: r, column: col });
        } else {
          content = formatCellValue(value);
        }

        const decorations = grid.getCellDecorations(r, col.id);
        let cellClassName = 'gs-cell';
        const cellStyle: CSSProperties = {
          position: 'absolute',
          left: columnLayout.offsets[c],
          width: columnLayout.widths[c],
          height: rowHeight,
          boxSizing: 'border-box',
          overflow: 'hidden',
        };
        const attrs: Record<string, string> = {};

        for (const dec of decorations) {
          if (dec.className) cellClassName += ` ${dec.className}`;
          if (dec.style) Object.assign(cellStyle, dec.style);
          if (dec.attributes) Object.assign(attrs, dec.attributes);
        }

        cells.push(
          <div key={col.id} className={cellClassName} style={cellStyle} {...attrs}>
            {content}
          </div>,
        );
      }

      result.push(
        <div
          key={r}
          className="gs-row"
          style={{
            position: 'absolute',
            top: r * rowHeight,
            left: 0,
            width: columnLayout.totalWidth,
            height: rowHeight,
          }}
        >
          {cells}
        </div>,
      );
    }

    return result;
  }, [visibleRange, totalRows, columns, grid, columnLayout, columnIds, rowHeight, dataVersion]);

  // ─── JSX ───────────────────────────────────────────────

  return (
    <div
      className={className ? `gs-grid ${className}` : 'gs-grid'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="gs-header"
        style={{
          position: 'relative',
          height: headerHeight,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          ref={headerInnerRef}
          style={{
            position: 'relative',
            width: columnLayout.totalWidth,
          }}
        >
          {headerCells}
        </div>
      </div>
      <div
        ref={viewportRef}
        className="gs-viewport"
        style={{
          position: 'relative',
          overflow: 'auto',
          flex: 1,
        }}
      >
        <div
          className="gs-canvas"
          style={{
            position: 'relative',
            height: totalHeight,
            width: columnLayout.totalWidth,
          }}
        >
          {rowElements}
        </div>
      </div>
    </div>
  );
});
