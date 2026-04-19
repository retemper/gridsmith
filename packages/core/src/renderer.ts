import {
  buildCellId,
  computeRowCount,
  createAnnouncer,
  dataRowAriaIndex,
  headerRowAriaIndex,
  nextGridInstanceId,
  type Announcer,
} from './aria';
import { buildHeaderRows, getHeaderDepth, type HeaderCell } from './column-group';
import type { Unsubscribe } from './signal';
import type {
  ColumnDef,
  GridInstance,
  SelectionPluginApi,
  SelectionState,
  SortState,
  VisibleRange,
} from './types';
import {
  computeColumnLayout,
  calculateVisibleRange,
  getTotalHeight,
  DEFAULT_CONFIG,
  type VirtualizationConfig,
  type ColumnLayout,
} from './virtualization';

// ─── Renderer Options ─────────────────────────────────────

export interface RendererOptions {
  /** Container element to mount the grid into */
  container: HTMLElement;
  /** Grid instance to render */
  grid: GridInstance;
  /** Fixed row height in pixels (default: 32) */
  rowHeight?: number;
  /** Header row height in pixels (default: rowHeight) */
  headerHeight?: number;
  /** Number of extra rows/cols to render outside viewport (default: 3) */
  overscan?: number;
  /** Default column width in pixels (default: 100) */
  defaultColumnWidth?: number;
}

export interface RendererInstance {
  /** Force a full re-render */
  refresh(): void;
  /** Clean up and remove all DOM elements */
  destroy(): void;
}

// ─── CSS Class Names ──────────────────────────────────────

const CLS = {
  root: 'gs-grid',
  header: 'gs-header',
  headerRow: 'gs-header-row',
  headerCell: 'gs-header-cell',
  headerGroup: 'gs-header-cell--group',
  viewport: 'gs-viewport',
  canvas: 'gs-canvas',
  row: 'gs-row',
  cell: 'gs-cell',
  srOnly: 'gs-sr-only',
} as const;

// ─── Renderer Implementation ──────────────────────────────

export function createRenderer(options: RendererOptions): RendererInstance {
  const { container, grid } = options;

  const config: VirtualizationConfig = {
    rowHeight: options.rowHeight ?? DEFAULT_CONFIG.rowHeight,
    overscan: options.overscan ?? DEFAULT_CONFIG.overscan,
    defaultColumnWidth: options.defaultColumnWidth ?? DEFAULT_CONFIG.defaultColumnWidth,
  };

  const headerRowHeight = options.headerHeight ?? config.rowHeight;

  // ─── DOM Structure ────────────────────────────────────
  // <div.gs-grid>
  //   <div.gs-header>
  //     <div.gs-header-cell /> ...
  //   </div>
  //   <div.gs-viewport>          ← scroll container
  //     <div.gs-canvas>          ← total size spacer
  //       <div.gs-row>           ← absolutely positioned
  //         <div.gs-cell /> ...
  //       </div> ...
  //     </div>
  //   </div>
  // </div>

  const gridInstanceId = nextGridInstanceId();

  const root = el('div', CLS.root);
  const header = el('div', CLS.header);
  const viewport = el('div', CLS.viewport);
  const canvas = el('div', CLS.canvas);
  const politeLiveRegion = el('div', CLS.srOnly);
  const assertiveLiveRegion = el('div', CLS.srOnly);

  let headerDepth = Math.max(1, getHeaderDepth(grid.columnDefs.get()));
  let totalHeaderHeight = headerRowHeight * headerDepth;

  root.id = gridInstanceId;
  root.setAttribute('role', 'grid');
  root.style.cssText = 'position:relative;overflow:hidden;';
  header.setAttribute('role', 'rowgroup');
  header.style.cssText = `position:relative;height:${totalHeaderHeight}px;overflow:hidden;`;
  viewport.setAttribute('role', 'rowgroup');
  viewport.style.cssText = 'position:relative;overflow:auto;will-change:transform;';
  canvas.style.cssText = 'position:relative;';

  configureLiveRegion(politeLiveRegion, 'status', 'polite');
  configureLiveRegion(assertiveLiveRegion, 'alert', 'assertive');

  viewport.appendChild(canvas);
  root.appendChild(header);
  root.appendChild(viewport);
  container.appendChild(politeLiveRegion);
  container.appendChild(assertiveLiveRegion);
  container.appendChild(root);

  const politeAnnouncer: Announcer = createAnnouncer(politeLiveRegion);
  const assertiveAnnouncer: Announcer = createAnnouncer(assertiveLiveRegion);

  // ─── State ────────────────────────────────────────────

  let columnLayout: ColumnLayout = computeColumnLayout(
    grid.columns.get(),
    config.defaultColumnWidth,
  );
  let prevRange: VisibleRange | null = null;
  let rafId: number | null = null;
  let destroyed = false;

  // Row element pool: reuse DOM nodes to minimize GC
  const rowPool: HTMLDivElement[] = [];
  // Currently rendered rows: viewIndex → element
  const activeRows = new Map<number, HTMLDivElement>();

  // ─── Sizing ───────────────────────────────────────────

  function updateSizing() {
    const totalHeight = getTotalHeight(grid.rowCount, config.rowHeight);
    canvas.style.height = `${totalHeight}px`;
    canvas.style.width = `${columnLayout.totalWidth}px`;
    header.style.width = `${columnLayout.totalWidth}px`;
    header.style.height = `${totalHeaderHeight}px`;

    // Viewport height = container height minus header
    const containerHeight = container.clientHeight;
    viewport.style.height = `${containerHeight - totalHeaderHeight}px`;

    updateAriaCounts();
  }

  function updateAriaCounts() {
    const rowCount = computeRowCount({
      headerDepth,
      pinnedTop: 0,
      rowCount: grid.rowCount,
      pinnedBottom: 0,
    });
    const visibleLeafColumns = grid.columns.get().filter((c) => c.visible !== false).length;
    root.setAttribute('aria-rowcount', String(rowCount));
    root.setAttribute('aria-colcount', String(visibleLeafColumns));
  }

  function updateActiveDescendant(state: SelectionState) {
    const active = state.activeCell;
    if (!active) {
      root.removeAttribute('aria-activedescendant');
      return;
    }
    const id = buildCellId(gridInstanceId, active.row, active.col);
    const target = document.getElementById(id);
    if (target && root.contains(target)) {
      root.setAttribute('aria-activedescendant', id);
    } else {
      root.removeAttribute('aria-activedescendant');
    }
  }

  function announceSort(sort: SortState) {
    if (sort.length === 0) {
      politeAnnouncer.announce('Sort cleared');
      return;
    }
    const columnIds = grid.columns.get();
    const parts = sort.map((entry) => {
      const col = columnIds.find((c) => c.id === entry.columnId);
      const label = col?.header ?? entry.columnId;
      return `${label} ${entry.direction === 'asc' ? 'ascending' : 'descending'}`;
    });
    politeAnnouncer.announce(`Sorted by ${parts.join(', ')}`);
  }

  // ─── Header Rendering ────────────────────────────────

  function renderHeader() {
    header.innerHTML = '';
    const tree = grid.columnDefs.get();
    const leafColumns = grid.columns.get();
    const rows = buildHeaderRows(tree);

    for (let r = 0; r < rows.length; r++) {
      const rowEl = el('div', CLS.headerRow);
      rowEl.setAttribute('role', 'row');
      rowEl.setAttribute('aria-rowindex', String(headerRowAriaIndex(r)));
      rowEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      for (const cellDef of rows[r]) {
        const { left, width } = spanExtent(cellDef, columnLayout, leafColumns);
        if (width === 0) continue; // all spanned columns are hidden
        const cell = el(
          'div',
          cellDef.isLeaf ? CLS.headerCell : `${CLS.headerCell} ${CLS.headerGroup}`,
        );
        cell.textContent = cellDef.column.header;
        cell.setAttribute('role', 'columnheader');
        cell.setAttribute('aria-colindex', String(cellDef.colStart + 1));
        if (cellDef.colSpan > 1) cell.setAttribute('aria-colspan', String(cellDef.colSpan));
        if (cellDef.rowSpan > 1) cell.setAttribute('aria-rowspan', String(cellDef.rowSpan));
        const top = r * headerRowHeight;
        const height = cellDef.rowSpan * headerRowHeight;
        cell.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;pointer-events:auto;`;
        rowEl.appendChild(cell);
      }
      header.appendChild(rowEl);
    }
  }

  function spanExtent(
    cell: HeaderCell,
    layout: ColumnLayout,
    leafColumns: ColumnDef[],
  ): { left: number; width: number } {
    const left = layout.offsets[cell.colStart] ?? 0;
    let width = 0;
    for (let i = cell.colStart; i < cell.colStart + cell.colSpan; i++) {
      const leaf = leafColumns[i];
      if (leaf && leaf.visible === false) continue;
      width += layout.widths[i] ?? 0;
    }
    return { left, width };
  }

  // ─── Cell Rendering ───────────────────────────────────

  function renderRow(viewIndex: number, columns: ColumnDef[], range: VisibleRange): HTMLDivElement {
    const row = acquireRow();
    row.innerHTML = '';
    row.style.cssText = `position:absolute;top:${viewIndex * config.rowHeight}px;left:0;width:${columnLayout.totalWidth}px;height:${config.rowHeight}px;`;
    row.dataset.viewIndex = String(viewIndex);
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(dataRowAriaIndex(viewIndex, headerDepth, 0)));

    for (let c = range.colStart; c <= range.colEnd; c++) {
      const col = columns[c];
      if (col.visible === false) continue;

      const cell = el('div', CLS.cell);
      const value = grid.getCell(viewIndex, col.id);
      cell.textContent = formatCellValue(value);
      cell.style.cssText = `position:absolute;left:${columnLayout.offsets[c]}px;width:${columnLayout.widths[c]}px;height:${config.rowHeight}px;box-sizing:border-box;overflow:hidden;`;
      cell.id = buildCellId(gridInstanceId, viewIndex, col.id);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(c + 1));
      if (col.editable === false) cell.setAttribute('aria-readonly', 'true');

      // Apply cell decorations
      const decorations = grid.getCellDecorations(viewIndex, col.id);
      for (const dec of decorations) {
        if (dec.className) cell.classList.add(...dec.className.split(' '));
        if (dec.style) Object.assign(cell.style, dec.style);
        if (dec.attributes) {
          for (const [k, v] of Object.entries(dec.attributes)) {
            cell.setAttribute(k, v);
          }
        }
      }

      row.appendChild(cell);
    }

    return row;
  }

  function acquireRow(): HTMLDivElement {
    return rowPool.pop() ?? document.createElement('div');
  }

  function releaseRow(row: HTMLDivElement) {
    row.innerHTML = '';
    rowPool.push(row);
  }

  // ─── Render Loop ──────────────────────────────────────

  function render() {
    if (destroyed) return;

    // Always refresh sizing before computing visible range
    // (handles filter/data changes that alter row count)
    updateSizing();

    const totalRows = grid.rowCount;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const scrollTop = viewport.scrollTop;
    const scrollLeft = viewport.scrollLeft;

    if (totalRows === 0) {
      clearAllRows();
      prevRange = null;
      return;
    }

    const range = calculateVisibleRange(
      scrollTop,
      scrollLeft,
      viewportWidth,
      viewportHeight,
      totalRows,
      columnLayout,
      config,
    );

    // Sync header scroll
    header.scrollLeft = scrollLeft;

    const columns = grid.columns.get();

    // Check if we need to re-render columns (horizontal scroll changed)
    const colsChanged =
      !prevRange || range.colStart !== prevRange.colStart || range.colEnd !== prevRange.colEnd;

    // Remove rows that are no longer visible
    for (const [viewIndex, row] of activeRows) {
      if (viewIndex < range.rowStart || viewIndex > range.rowEnd) {
        canvas.removeChild(row);
        releaseRow(row);
        activeRows.delete(viewIndex);
      }
    }

    // Add or update visible rows
    for (let r = range.rowStart; r <= range.rowEnd; r++) {
      const existing = activeRows.get(r);
      if (existing && !colsChanged) {
        // Row already rendered and columns haven't changed
        continue;
      }

      if (existing) {
        canvas.removeChild(existing);
        releaseRow(existing);
      }

      const row = renderRow(r, columns, range);
      row.className = CLS.row;
      canvas.appendChild(row);
      activeRows.set(r, row);
    }

    prevRange = range;

    // Refresh active-descendant now that the new cell ids are in the DOM.
    const selectionApi = grid.getPlugin<SelectionPluginApi>('selection');
    if (selectionApi) updateActiveDescendant(selectionApi.getState());
  }

  function clearAllRows() {
    for (const [, row] of activeRows) {
      canvas.removeChild(row);
      releaseRow(row);
    }
    activeRows.clear();
  }

  function scheduleRender() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  }

  // ─── Event Listeners ─────────────────────────────────

  function onScroll() {
    scheduleRender();
  }

  viewport.addEventListener('scroll', onScroll, { passive: true });

  // ResizeObserver for container resize
  const resizeObserver = new ResizeObserver(() => {
    updateSizing();
    scheduleRender();
  });
  resizeObserver.observe(container);

  // Subscribe to grid state changes
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    grid.subscribe('data:rowsUpdate', () => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  unsubs.push(
    grid.subscribe('data:change', () => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  unsubs.push(
    grid.subscribe('columns:update', () => {
      columnLayout = computeColumnLayout(grid.columns.get(), config.defaultColumnWidth);
      headerDepth = Math.max(1, getHeaderDepth(grid.columnDefs.get()));
      totalHeaderHeight = headerRowHeight * headerDepth;
      renderHeader();
      updateSizing();
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  // Width-only updates skip the header/depth rebuild since the leaf list and
  // header structure are unchanged.
  unsubs.push(
    grid.subscribe('column:resize', () => {
      columnLayout = computeColumnLayout(grid.columns.get(), config.defaultColumnWidth);
      updateSizing();
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  unsubs.push(
    grid.subscribe('sort:change', ({ sort }) => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
      announceSort(sort);
    }),
  );

  unsubs.push(
    grid.subscribe('filter:change', () => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
      politeAnnouncer.announce(`Showing ${grid.rowCount} rows`);
    }),
  );

  unsubs.push(
    grid.subscribe('selection:change', (state) => {
      updateActiveDescendant(state);
    }),
  );

  // Key-based diff catches the clear-and-add-in-same-tick case that a
  // simple count comparison would miss.
  let prevErrorKeys = new Set<string>();
  unsubs.push(
    grid.subscribe('validation:change', ({ errors }) => {
      const nonPending = errors.filter((e) => e.state !== 'pending');
      const currentKeys = new Set(nonPending.map((e) => `${e.dataIndex}:${e.columnId}`));
      const newlyAdded = nonPending.find((e) => !prevErrorKeys.has(`${e.dataIndex}:${e.columnId}`));
      if (newlyAdded) assertiveAnnouncer.announce(`Invalid: ${newlyAdded.message}`);
      prevErrorKeys = currentKeys;
    }),
  );

  // ─── Initial Render ───────────────────────────────────

  updateSizing();
  renderHeader();
  render();

  // ─── Public API ───────────────────────────────────────

  return {
    refresh() {
      columnLayout = computeColumnLayout(grid.columns.get(), config.defaultColumnWidth);
      headerDepth = Math.max(1, getHeaderDepth(grid.columnDefs.get()));
      totalHeaderHeight = headerRowHeight * headerDepth;
      renderHeader();
      updateSizing();
      clearAllRows();
      prevRange = null;
      render();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      viewport.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();

      for (const unsub of unsubs) unsub();
      unsubs.length = 0;

      politeAnnouncer.destroy();
      assertiveAnnouncer.destroy();

      clearAllRows();
      rowPool.length = 0;

      container.removeChild(root);
      if (politeLiveRegion.parentNode === container) {
        container.removeChild(politeLiveRegion);
      }
      if (assertiveLiveRegion.parentNode === container) {
        container.removeChild(assertiveLiveRegion);
      }
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────

function el(tag: string, className: string): HTMLDivElement {
  const element = document.createElement(tag) as HTMLDivElement;
  element.className = className;
  return element;
}

function configureLiveRegion(node: HTMLElement, role: string, politeness: 'polite' | 'assertive') {
  node.setAttribute('role', role);
  node.setAttribute('aria-live', politeness);
  node.setAttribute('aria-atomic', 'true');
  node.style.cssText =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
}

function formatCellValue(value: string | number | boolean | Date | null | undefined): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}
