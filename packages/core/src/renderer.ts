import type { Unsubscribe } from './signal';
import type { GridInstance, ColumnDef, VisibleRange } from './types';
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
  headerCell: 'gs-header-cell',
  viewport: 'gs-viewport',
  canvas: 'gs-canvas',
  row: 'gs-row',
  cell: 'gs-cell',
} as const;

// ─── Renderer Implementation ──────────────────────────────

export function createRenderer(options: RendererOptions): RendererInstance {
  const { container, grid } = options;

  const config: VirtualizationConfig = {
    rowHeight: options.rowHeight ?? DEFAULT_CONFIG.rowHeight,
    overscan: options.overscan ?? DEFAULT_CONFIG.overscan,
    defaultColumnWidth: options.defaultColumnWidth ?? DEFAULT_CONFIG.defaultColumnWidth,
  };

  const headerHeight = options.headerHeight ?? config.rowHeight;

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

  const root = el('div', CLS.root);
  const header = el('div', CLS.header);
  const viewport = el('div', CLS.viewport);
  const canvas = el('div', CLS.canvas);

  root.style.cssText = 'position:relative;overflow:hidden;';
  header.style.cssText = `position:relative;height:${headerHeight}px;overflow:hidden;display:flex;`;
  viewport.style.cssText = 'position:relative;overflow:auto;will-change:transform;';
  canvas.style.cssText = 'position:relative;';

  viewport.appendChild(canvas);
  root.appendChild(header);
  root.appendChild(viewport);
  container.appendChild(root);

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

    // Viewport height = container height minus header
    const containerHeight = container.clientHeight;
    viewport.style.height = `${containerHeight - headerHeight}px`;
  }

  // ─── Header Rendering ────────────────────────────────

  function renderHeader() {
    header.innerHTML = '';
    const columns = grid.columns.get();
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (col.visible === false) continue;
      const cell = el('div', CLS.headerCell);
      cell.textContent = col.header;
      cell.style.cssText = `position:absolute;left:${columnLayout.offsets[c]}px;width:${columnLayout.widths[c]}px;height:${headerHeight}px;box-sizing:border-box;overflow:hidden;`;
      header.appendChild(cell);
    }
  }

  // ─── Cell Rendering ───────────────────────────────────

  function renderRow(viewIndex: number, columns: ColumnDef[], range: VisibleRange): HTMLDivElement {
    const row = acquireRow();
    row.innerHTML = '';
    row.style.cssText = `position:absolute;top:${viewIndex * config.rowHeight}px;left:0;width:${columnLayout.totalWidth}px;height:${config.rowHeight}px;`;
    row.dataset.viewIndex = String(viewIndex);

    for (let c = range.colStart; c <= range.colEnd; c++) {
      const col = columns[c];
      if (col.visible === false) continue;

      const cell = el('div', CLS.cell);
      const value = grid.getCell(viewIndex, col.id);
      cell.textContent = formatCellValue(value);
      cell.style.cssText = `position:absolute;left:${columnLayout.offsets[c]}px;width:${columnLayout.widths[c]}px;height:${config.rowHeight}px;box-sizing:border-box;overflow:hidden;`;

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
      renderHeader();
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  unsubs.push(
    grid.subscribe('sort:change', () => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
    }),
  );

  unsubs.push(
    grid.subscribe('filter:change', () => {
      clearAllRows();
      prevRange = null;
      scheduleRender();
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

      clearAllRows();
      rowPool.length = 0;

      container.removeChild(root);
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────

function el(tag: string, className: string): HTMLDivElement {
  const element = document.createElement(tag) as HTMLDivElement;
  element.className = className;
  return element;
}

function formatCellValue(value: string | number | boolean | Date | null | undefined): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}
