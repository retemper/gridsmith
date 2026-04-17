import {
  type CellValue,
  type EditingPluginApi,
  type EditState,
  type FilterEntry,
  type GridInstance,
  type Row,
  type VisibleRange,
  calculateVisibleRange,
  computeColumnLayout,
  createEditingPlugin,
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

import { CellEditorOverlay } from './cell-editor';
import { FilterPopover } from './filter-popover';
import { cycleSortState } from './header-sort';
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

/** Check if a keydown event is a printable character for type-to-edit. */
function isPrintableKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key.length === 1;
}

/**
 * Navigation key set handled by the grid root when no editor is active. When
 * the key matches, the grid owns it (preventDefault + focus update); otherwise
 * the key falls through to existing editing-entry handling (F2, Enter, etc.).
 */
const NAV_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Tab',
]);

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
  pinnedTopRows: pinnedTopRowsProp,
  pinnedBottomRows: pinnedBottomRowsProp,
  onCellChange,
  onSortChange,
  onFilterChange,
  onColumnResize,
  onColumnReorder,
}: GridProps) {
  const headerHeight = headerHeightProp ?? rowHeight;

  // Inject editing plugin automatically. `useGrid` creates the grid once
  // via `useState`, so the plugin list is consumed a single time on mount.
  // Use a lazy `useState` to make the one-shot nature explicit and avoid
  // constructing throwaway plugin instances on every render.
  const [allPlugins] = useState(() => {
    const editingPlugin = createEditingPlugin();
    return plugins ? [editingPlugin, ...plugins] : [editingPlugin];
  });

  const grid = useGrid({ data, columns, plugins: allPlugins });

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

  useEffect(() => {
    if (!onColumnResize) return;
    return grid.subscribe('column:resize', ({ columnId, width }) =>
      onColumnResize(columnId, width),
    );
  }, [grid, onColumnResize]);

  useEffect(() => {
    if (!onColumnReorder) return;
    return grid.subscribe('column:reorder', ({ columnId, fromIndex, toIndex }) =>
      onColumnReorder(columnId, fromIndex, toIndex),
    );
  }, [grid, onColumnReorder]);

  // Sync pinned rows
  useEffect(() => {
    grid.setPinnedTopRows(pinnedTopRowsProp ?? []);
  }, [pinnedTopRowsProp, grid]);

  useEffect(() => {
    grid.setPinnedBottomRows(pinnedBottomRowsProp ?? []);
  }, [pinnedBottomRowsProp, grid]);

  // ─── Editing state ─────────────────────────────────────

  const editingApi = useMemo(() => {
    const api = grid.getPlugin<EditingPluginApi>('editing');
    if (!api) throw new Error('Editing plugin not found — this should not happen');
    return api;
  }, [grid]);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [focusedCell, setFocusedCell] = useState<{
    row: number;
    col: string;
    colIndex: number;
  } | null>(null);

  useEffect(() => {
    const unsubs = [
      grid.subscribe('edit:begin', (state) => setEditState({ ...state })),
      grid.subscribe('edit:commit', () => setEditState(null)),
      grid.subscribe('edit:cancel', () => setEditState(null)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [grid]);

  // Clear focused cell when sort/filter/data/columns change, since view
  // indices may no longer refer to the same underlying row.
  useEffect(() => {
    const unsubs = [
      grid.subscribe('sort:change', () => setFocusedCell(null)),
      grid.subscribe('filter:change', () => setFocusedCell(null)),
      grid.subscribe('data:rowsUpdate', () => setFocusedCell(null)),
      grid.subscribe('columns:update', () => setFocusedCell(null)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [grid]);

  // ─── Reactive state from core ──────────────────────────

  const currentColumns = useSignalValue(grid.columns);
  const currentSort = useSignalValue(grid.sortState);
  const currentFilter = useSignalValue(grid.filterState);
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
    // Expose scrollLeft as CSS custom property for pinned column transforms
    el.style.setProperty('--gs-scroll-left', `${el.scrollLeft}px`);
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

  // ─── Sort / Filter interaction ─────────────────────────

  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);

  const handleHeaderSortClick = useCallback(
    (columnId: string, shift: boolean) => {
      const col = currentColumns.find((c) => c.id === columnId);
      if (!col || col.sortable === false) return;
      const next = cycleSortState(grid.sortState.get(), columnId, shift);
      grid.sortState.set(next);
    },
    [currentColumns, grid],
  );

  const handleFilterApply = useCallback(
    (columnId: string, entry: FilterEntry | null) => {
      const prev = grid.filterState.get();
      const others = prev.filter((f) => f.columnId !== columnId);
      const next = entry ? [...others, entry] : others;
      grid.filterState.set(next);
      setOpenFilterCol(null);
    },
    [grid],
  );

  // Maps for quick indicator rendering.
  const sortIndexByCol = useMemo(() => {
    const m = new Map<string, { direction: 'asc' | 'desc'; index: number }>();
    currentSort.forEach((e, i) => m.set(e.columnId, { direction: e.direction, index: i }));
    return m;
  }, [currentSort]);

  const filterByCol = useMemo(() => {
    const m = new Map<string, FilterEntry>();
    currentFilter.forEach((e) => m.set(e.columnId, e));
    return m;
  }, [currentFilter]);

  // ─── Column resize ─────────────────────────────────────

  const resizeRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, colId: string, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = {
        columnId: colId,
        startX: e.clientX,
        startWidth: columnLayout.widths[colIndex],
      };
    },
    [columnLayout],
  );

  const resizeRafRef = useRef<number | null>(null);

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = resizeRef.current.startWidth + delta;
      const colId = resizeRef.current.columnId;
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        grid.resizeColumn(colId, newWidth);
      });
    },
    [grid],
  );

  const handleResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const handleResizeDoubleClick = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      // Auto-fit: measure content width by scanning visible rows
      const vp = viewportRef.current;
      if (!vp) return;
      const cells = vp.querySelectorAll(`[data-col="${colId}"]`);
      let maxWidth = 60; // minimum auto-fit width
      cells.forEach((cell) => {
        maxWidth = Math.max(maxWidth, (cell as HTMLElement).scrollWidth + 16);
      });
      grid.resizeColumn(colId, maxWidth);
    },
    [grid],
  );

  // ─── Column reorder (drag & drop) ─────────────────────

  const dragRef = useRef<{
    columnId: string;
    fromIndex: number;
  } | null>(null);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, colId: string, colIndex: number) => {
    dragRef.current = { columnId: colId, fromIndex: colIndex };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const headerCell = (e.target as HTMLElement).closest('.gs-header-cell') as HTMLElement | null;
      if (!headerCell) return;
      const colId = headerCell.dataset.col;
      if (!colId) return;
      const idx = currentColumns.findIndex((c) => c.id === colId);
      if (idx !== -1) setDragOverIndex(idx);
    },
    [currentColumns],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragRef.current || dragOverIndex === null) return;
      grid.reorderColumn(dragRef.current.fromIndex, dragOverIndex);
      dragRef.current = null;
      setDragOverIndex(null);
    },
    [grid, dragOverIndex],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragOverIndex(null);
  }, []);

  // ─── Pinned rows ──────────────────────────────────────

  const currentPinnedTop = useSignalValue(grid.pinnedTopRows);
  const currentPinnedBottom = useSignalValue(grid.pinnedBottomRows);

  // ─── Render header ─────────────────────────────────────

  const renderHeaderCell = useCallback(
    (col: (typeof currentColumns)[number], i: number) => {
      if (col.visible === false) return null;
      const sortInfo = sortIndexByCol.get(col.id);
      const hasFilter = filterByCol.has(col.id);
      const sortable = col.sortable !== false;
      const filterable = col.filterable !== false;
      const isMulti = currentSort.length > 1;
      const resizable = col.resizable !== false;
      const isPinned = col.pin === 'left' || col.pin === 'right';
      const isDragOver = dragOverIndex === i;

      return (
        <div
          key={col.id}
          className={`gs-header-cell${sortable ? ' gs-header-cell--sortable' : ''}${isPinned ? ' gs-header-cell--pinned' : ''}${isDragOver ? ' gs-header-cell--drag-over' : ''}`}
          role="columnheader"
          aria-sort={
            sortInfo ? (sortInfo.direction === 'asc' ? 'ascending' : 'descending') : 'none'
          }
          data-col={col.id}
          draggable
          onDragStart={(e) => handleDragStart(e, col.id, i)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          style={{
            position: 'absolute',
            left: columnLayout.offsets[i],
            width: columnLayout.widths[i],
            height: headerHeight,
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          <button
            type="button"
            className="gs-header-label"
            disabled={!sortable}
            onClick={(e) => {
              if (!sortable) return;
              handleHeaderSortClick(col.id, e.shiftKey);
            }}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              padding: '0 6px',
              height: '100%',
              cursor: sortable ? 'pointer' : 'default',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            {col.header}
            {sortInfo ? (
              <span className="gs-header-sort-indicator" aria-hidden="true">
                {' '}
                {sortInfo.direction === 'asc' ? '▲' : '▼'}
                {isMulti ? <sub>{sortInfo.index + 1}</sub> : null}
              </span>
            ) : null}
          </button>
          {filterable ? (
            <button
              type="button"
              className={`gs-header-filter-btn${hasFilter ? ' gs-header-filter-btn--active' : ''}`}
              aria-label={`Filter ${col.header}`}
              aria-haspopup="dialog"
              aria-expanded={openFilterCol === col.id}
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilterCol((cur) => (cur === col.id ? null : col.id));
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0 6px',
                height: '100%',
                color: hasFilter ? '#1a66ff' : 'inherit',
                font: 'inherit',
              }}
            >
              ⚲
            </button>
          ) : null}
          {resizable ? (
            <div
              className="gs-resize-handle"
              onPointerDown={(e) => handleResizePointerDown(e, col.id, i)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onDoubleClick={(e) => handleResizeDoubleClick(e, col.id)}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 6,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 1,
              }}
            />
          ) : null}
        </div>
      );
    },
    [
      currentColumns,
      columnLayout,
      headerHeight,
      sortIndexByCol,
      filterByCol,
      currentSort.length,
      handleHeaderSortClick,
      openFilterCol,
      dragOverIndex,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      handleResizePointerDown,
      handleResizePointerMove,
      handleResizePointerUp,
      handleResizeDoubleClick,
    ],
  );

  const headerCells = useMemo(
    () => currentColumns.map((col, i) => renderHeaderCell(col, i)),
    [currentColumns, renderHeaderCell],
  );

  // ─── Filter popover ────────────────────────────────────

  const filterPopover = useMemo(() => {
    if (!openFilterCol) return null;
    const colIndex = currentColumns.findIndex((c) => c.id === openFilterCol);
    if (colIndex === -1) return null;
    const col = currentColumns[colIndex];
    if (!col) return null;
    const entry = filterByCol.get(col.id) ?? null;
    const left = columnLayout.offsets[colIndex] ?? 0;
    return (
      <FilterPopover
        column={col}
        entry={entry}
        style={{ top: headerHeight, left }}
        onApply={(e) => handleFilterApply(col.id, e)}
        onClose={() => setOpenFilterCol(null)}
      />
    );
  }, [openFilterCol, currentColumns, filterByCol, columnLayout, headerHeight, handleFilterApply]);

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
        const isPinned = col.pin === 'left' || col.pin === 'right';
        let cellClassName = 'gs-cell';
        if (col.pin === 'left') cellClassName += ' gs-cell--pinned-left';
        if (col.pin === 'right') cellClassName += ' gs-cell--pinned-right';
        const cellStyle: CSSProperties = {
          position: 'absolute',
          left: columnLayout.offsets[c],
          width: columnLayout.widths[c],
          height: rowHeight,
          boxSizing: 'border-box',
          overflow: 'hidden',
          // Pinned columns: translate by scrollLeft so they stay fixed in
          // the viewport. The CSS custom property is set on every scroll
          // event via direct DOM mutation, avoiding React re-renders.
          ...(isPinned && {
            zIndex: 2,
            background: 'inherit',
            transform: 'translateX(var(--gs-scroll-left, 0px))',
          }),
        };
        const attrs: Record<string, string> = {};

        for (const dec of decorations) {
          if (dec.className) cellClassName += ` ${dec.className}`;
          if (dec.style) Object.assign(cellStyle, dec.style);
          if (dec.attributes) Object.assign(attrs, dec.attributes);
        }

        // Keyboard focus indicator — purely visual, consumers can restyle via
        // `.gs-cell--focused`. Not a core decoration because focus is an
        // adapter-level concern tied to the Grid component's React state.
        if (focusedCell && focusedCell.row === r && focusedCell.col === col.id) {
          cellClassName += ' gs-cell--focused';
        }

        cells.push(
          <div
            key={col.id}
            className={cellClassName}
            style={cellStyle}
            data-row={r}
            data-col={col.id}
            {...attrs}
          >
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
  }, [
    visibleRange,
    totalRows,
    columns,
    grid,
    columnLayout,
    columnIds,
    rowHeight,
    dataVersion,
    focusedCell,
  ]);

  // ─── Cell interaction handlers ──────────────────────────

  const parseCellFromTarget = useCallback(
    (target: EventTarget | null): { row: number; col: string; colIndex: number } | null => {
      const el = (target as HTMLElement | null)?.closest?.('.gs-cell') as HTMLElement | null;
      if (!el) return null;
      const row = Number(el.dataset.row);
      const col = el.dataset.col;
      if (col == null || Number.isNaN(row)) return null;
      const colIndex = currentColumns.findIndex((c) => c.id === col);
      if (colIndex === -1) return null;
      return { row, col, colIndex };
    },
    [currentColumns],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const cell = parseCellFromTarget(e.target);
      if (!cell) return;
      const colDef = currentColumns[cell.colIndex];
      if (!colDef || colDef.editable === false) return;

      const editorType = colDef.editor ?? colDef.type ?? 'text';
      if (editorType === 'checkbox') {
        // Checkbox: toggle on double-click
        const current = grid.getCell(cell.row, cell.col);
        grid.setCell(cell.row, cell.col, !current);
      } else {
        editingApi.beginEdit(cell.row, cell.col);
      }
      setFocusedCell(cell);
    },
    [parseCellFromTarget, currentColumns, editingApi, grid],
  );

  const handleCellClick = useCallback(
    (e: React.MouseEvent) => {
      const cell = parseCellFromTarget(e.target);
      if (!cell) return;

      // If clicking a different cell while editing, commit current edit
      if (editState && (editState.rowIndex !== cell.row || editState.columnId !== cell.col)) {
        editingApi.commitEdit();
      }

      setFocusedCell(cell);

      // Checkbox: toggle on single click
      const colDef = currentColumns[cell.colIndex];
      if (colDef && colDef.editable !== false) {
        const editorType = colDef.editor ?? colDef.type ?? 'text';
        if (editorType === 'checkbox') {
          const current = grid.getCell(cell.row, cell.col);
          grid.setCell(cell.row, cell.col, !current);
        }
      }
    },
    [parseCellFromTarget, editState, editingApi, currentColumns, grid],
  );

  // ─── Navigation helpers ────────────────────────────────

  /** Ordered list of visible column indices. Hidden columns are skipped
   *  during navigation so arrow keys never land on an invisible cell. */
  const visibleColIndices = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < currentColumns.length; i++) {
      if (currentColumns[i].visible !== false) out.push(i);
    }
    return out;
  }, [currentColumns]);

  const scrollFocusIntoView = useCallback(
    (row: number, colIndex: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const cellTop = row * rowHeight;
      const cellBottom = cellTop + rowHeight;
      const cellLeft = columnLayout.offsets[colIndex] ?? 0;
      const cellRight = cellLeft + (columnLayout.widths[colIndex] ?? 0);

      if (cellTop < el.scrollTop) el.scrollTop = cellTop;
      else if (cellBottom > el.scrollTop + el.clientHeight) {
        el.scrollTop = cellBottom - el.clientHeight;
      }

      if (cellLeft < el.scrollLeft) el.scrollLeft = cellLeft;
      else if (cellRight > el.scrollLeft + el.clientWidth) {
        el.scrollLeft = cellRight - el.clientWidth;
      }
    },
    [columnLayout, rowHeight],
  );

  const moveFocusTo = useCallback(
    (row: number, colIndex: number) => {
      if (totalRows === 0 || visibleColIndices.length === 0) return;
      const clampedRow = Math.max(0, Math.min(totalRows - 1, row));
      // colIndex must be one of the visible indices — callers compute from
      // `visibleColIndices`, but clamp defensively.
      const clampedCol =
        visibleColIndices.indexOf(colIndex) === -1 ? (visibleColIndices[0] ?? 0) : colIndex;
      const col = currentColumns[clampedCol];
      if (!col) return;
      setFocusedCell({ row: clampedRow, col: col.id, colIndex: clampedCol });
      scrollFocusIntoView(clampedRow, clampedCol);
    },
    [totalRows, visibleColIndices, currentColumns, scrollFocusIntoView],
  );

  /**
   * Return the visible column index one step left/right of the given one.
   * If no such column exists, return `null` (caller decides whether to wrap
   * to another row).
   */
  const stepVisibleCol = useCallback(
    (colIndex: number, delta: 1 | -1): number | null => {
      const pos = visibleColIndices.indexOf(colIndex);
      if (pos === -1) return null;
      const next = pos + delta;
      if (next < 0 || next >= visibleColIndices.length) return null;
      return visibleColIndices[next];
    },
    [visibleColIndices],
  );

  const firstVisibleColIndex = visibleColIndices[0] ?? 0;
  const lastVisibleColIndex = visibleColIndices[visibleColIndices.length - 1] ?? 0;

  const handleCommitAndMoveVertical = useCallback(
    (shift: boolean) => {
      // Resolve the *edited* cell, not `focusedCell` — Tab inside the editor
      // advances `editState` without touching `focusedCell`, so the two can
      // diverge. Using the edit target keeps Enter's "move down" relative to
      // the cell the user was actually editing.
      const state = editingApi.getEditState();
      editingApi.commitEdit();
      if (!state) return;
      const colIndex = currentColumns.findIndex((c) => c.id === state.columnId);
      if (colIndex === -1) return;
      const delta = shift ? -1 : 1;
      moveFocusTo(state.rowIndex + delta, colIndex);
    },
    [editingApi, currentColumns, moveFocusTo],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If currently editing, the editor handles its own keys
      if (editState) return;

      if (!focusedCell) return;

      const { row, colIndex } = focusedCell;
      const lastRow = totalRows - 1;
      const mod = e.ctrlKey || e.metaKey;

      // ─── Pure navigation keys ────────────────────────
      if (NAV_KEYS.has(e.key)) {
        e.preventDefault();
        switch (e.key) {
          case 'ArrowUp': {
            moveFocusTo(mod ? 0 : row - 1, colIndex);
            return;
          }
          case 'ArrowDown': {
            moveFocusTo(mod ? lastRow : row + 1, colIndex);
            return;
          }
          case 'ArrowLeft': {
            if (mod) {
              moveFocusTo(row, firstVisibleColIndex);
            } else {
              const next = stepVisibleCol(colIndex, -1);
              if (next !== null) moveFocusTo(row, next);
            }
            return;
          }
          case 'ArrowRight': {
            if (mod) {
              moveFocusTo(row, lastVisibleColIndex);
            } else {
              const next = stepVisibleCol(colIndex, 1);
              if (next !== null) moveFocusTo(row, next);
            }
            return;
          }
          case 'Home': {
            moveFocusTo(mod ? 0 : row, firstVisibleColIndex);
            return;
          }
          case 'End': {
            moveFocusTo(mod ? lastRow : row, lastVisibleColIndex);
            return;
          }
          case 'PageDown': {
            const el = viewportRef.current;
            const pageSize = el ? Math.max(1, Math.floor(el.clientHeight / rowHeight)) : 1;
            moveFocusTo(row + pageSize, colIndex);
            return;
          }
          case 'PageUp': {
            const el = viewportRef.current;
            const pageSize = el ? Math.max(1, Math.floor(el.clientHeight / rowHeight)) : 1;
            moveFocusTo(row - pageSize, colIndex);
            return;
          }
          case 'Tab': {
            // Tab wraps within the row; at boundaries it moves to the next/
            // previous row's last/first cell.
            if (e.shiftKey) {
              const prev = stepVisibleCol(colIndex, -1);
              if (prev !== null) moveFocusTo(row, prev);
              else if (row > 0) moveFocusTo(row - 1, lastVisibleColIndex);
            } else {
              const next = stepVisibleCol(colIndex, 1);
              if (next !== null) moveFocusTo(row, next);
              else if (row < lastRow) moveFocusTo(row + 1, firstVisibleColIndex);
            }
            return;
          }
        }
      }

      // Shift+Enter in nav mode = move up (Enter without shift preserves the
      // "begin edit" behavior users expect from the current grid).
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        moveFocusTo(row - 1, colIndex);
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        editingApi.beginEdit(focusedCell.row, focusedCell.col);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const colDef = currentColumns[focusedCell.colIndex];
        if (colDef && colDef.editable !== false) {
          const editorType = colDef.editor ?? colDef.type ?? 'text';
          if (editorType === 'checkbox') {
            const current = grid.getCell(focusedCell.row, focusedCell.col);
            grid.setCell(focusedCell.row, focusedCell.col, !current);
          } else {
            editingApi.beginEdit(focusedCell.row, focusedCell.col);
          }
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const colDef = currentColumns[focusedCell.colIndex];
        if (colDef && colDef.editable !== false) {
          grid.setCell(focusedCell.row, focusedCell.col, null);
        }
        return;
      }

      // Type-to-edit: printable character starts editing
      if (isPrintableKey(e.nativeEvent)) {
        const colDef = currentColumns[focusedCell.colIndex];
        if (colDef && colDef.editable !== false) {
          const editorType = colDef.editor ?? colDef.type ?? 'text';
          if (editorType === 'checkbox' || editorType === 'select') return;
          // For number editors, only start editing on characters that can
          // begin a number literal. Otherwise a stray letter would wipe the
          // cell to null on commit.
          if (editorType === 'number' && !/^[-0-9.]$/.test(e.key)) return;
          e.preventDefault();
          editingApi.beginEdit(focusedCell.row, focusedCell.col, e.key);
        }
      }
    },
    [
      editState,
      focusedCell,
      totalRows,
      currentColumns,
      editingApi,
      grid,
      moveFocusTo,
      stepVisibleCol,
      firstVisibleColIndex,
      lastVisibleColIndex,
      rowHeight,
    ],
  );

  // ─── Editor overlay ───────────────────────────────────

  const editorOverlay = useMemo(() => {
    if (!editState) return null;

    const colIndex = currentColumns.findIndex((c) => c.id === editState.columnId);
    if (colIndex === -1) return null;

    const editorStyle: CSSProperties = {
      position: 'absolute',
      top: editState.rowIndex * rowHeight,
      left: columnLayout.offsets[colIndex],
      width: columnLayout.widths[colIndex],
      height: rowHeight,
      zIndex: 10,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'stretch',
    };

    return (
      <CellEditorOverlay
        // Remount editor on every new edit so local input state resets.
        key={`${editState.rowIndex}:${editState.columnId}`}
        grid={grid}
        editingApi={editingApi}
        columns={columns}
        columnIndex={colIndex}
        rowIndex={editState.rowIndex}
        editValue={editState.value}
        columnId={editState.columnId}
        style={editorStyle}
        onCommitAndMoveVertical={handleCommitAndMoveVertical}
      />
    );
  }, [
    editState,
    currentColumns,
    columnLayout,
    rowHeight,
    grid,
    editingApi,
    columns,
    handleCommitAndMoveVertical,
  ]);

  // ─── Pinned rows rendering ─────────────────────────────

  const renderPinnedRows = useCallback(
    (dataIndices: number[], position: 'top' | 'bottom') => {
      if (dataIndices.length === 0) return null;

      // read dataVersion so pinned rows re-render on data changes
      void dataVersion;

      const rows: ReactNode[] = [];
      for (let i = 0; i < dataIndices.length; i++) {
        const dataIdx = dataIndices[i];
        // We need to find the viewIndex that maps to this data index,
        // or render directly from data if the row is filtered out.
        const cells: ReactNode[] = [];
        const dataSnapshot = grid.data;
        const row = dataSnapshot[dataIdx];
        if (!row) continue;
        for (let c = 0; c < currentColumns.length; c++) {
          const col = currentColumns[c];
          if (col.visible === false) continue;
          const value = row[col.id];
          const isPinned = col.pin === 'left' || col.pin === 'right';
          let cellClassName = 'gs-cell gs-cell--pinned-row';
          if (col.pin === 'left') cellClassName += ' gs-cell--pinned-left';
          if (col.pin === 'right') cellClassName += ' gs-cell--pinned-right';

          cells.push(
            <div
              key={col.id}
              className={cellClassName}
              style={{
                position: 'absolute',
                left: columnLayout.offsets[c],
                width: columnLayout.widths[c],
                height: rowHeight,
                boxSizing: 'border-box',
                overflow: 'hidden',
                background: 'inherit',
                ...(isPinned && { zIndex: 2 }),
              }}
            >
              {formatCellValue(value)}
            </div>,
          );
        }

        rows.push(
          <div
            key={dataIdx}
            className={`gs-row gs-row--pinned gs-row--pinned-${position}`}
            data-pinned={position}
            data-data-index={dataIdx}
            style={{
              position: 'relative',
              width: columnLayout.totalWidth,
              height: rowHeight,
            }}
          >
            {cells}
          </div>,
        );
      }

      return (
        <div
          className={`gs-pinned-rows gs-pinned-rows--${position}`}
          style={{
            position: 'relative',
            flexShrink: 0,
            overflow: 'hidden',
            zIndex: 3,
            borderBottom: position === 'top' ? '2px solid #e2e8f0' : undefined,
            borderTop: position === 'bottom' ? '2px solid #e2e8f0' : undefined,
          }}
        >
          {rows}
        </div>
      );
    },
    [currentColumns, columnLayout, rowHeight, grid, dataVersion],
  );

  const pinnedTopRowsEl = useMemo(
    () => renderPinnedRows(currentPinnedTop, 'top'),
    [renderPinnedRows, currentPinnedTop],
  );

  const pinnedBottomRowsEl = useMemo(
    () => renderPinnedRows(currentPinnedBottom, 'bottom'),
    [renderPinnedRows, currentPinnedBottom],
  );

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
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        className="gs-header"
        style={{
          // `overflow: visible` so the filter popover (which anchors at the
          // header cell's left edge and drops below `headerHeight`) is not
          // clipped by the header element's bounding box.
          position: 'relative',
          height: headerHeight,
          flexShrink: 0,
        }}
      >
        <div
          ref={headerInnerRef}
          style={{
            position: 'relative',
            width: columnLayout.totalWidth,
            height: headerHeight,
          }}
        >
          {headerCells}
          {filterPopover}
        </div>
      </div>
      {pinnedTopRowsEl}
      <div
        ref={viewportRef}
        className="gs-viewport"
        style={{
          position: 'relative',
          overflow: 'auto',
          flex: 1,
        }}
        onClick={handleCellClick}
        onDoubleClick={handleDoubleClick}
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
          {editorOverlay}
        </div>
      </div>
      {pinnedBottomRowsEl}
    </div>
  );
});
