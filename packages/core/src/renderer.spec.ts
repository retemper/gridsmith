// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createGrid } from './grid';
import { createRenderer, type RendererInstance } from './renderer';
import type { ColumnDef, Row } from './types';

// ─── Helpers ──────────────────────────────────────────────

const columns: ColumnDef[] = [
  { id: 'name', header: 'Name', width: 120 },
  { id: 'age', header: 'Age', width: 80 },
  { id: 'city', header: 'City', width: 100 },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `User ${i}`,
    age: 20 + (i % 50),
    city: i % 2 === 0 ? 'Seoul' : 'Tokyo',
  }));
}

// jsdom does not implement layout, so we mock clientWidth/clientHeight
function mockLayout(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
}

// Mock ResizeObserver since jsdom doesn't have it
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock requestAnimationFrame for synchronous testing
let pendingRAFCallbacks: FrameRequestCallback[] = [];

function mockRAF() {
  let id = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pendingRAFCallbacks.push(cb);
    return ++id;
  });

  vi.stubGlobal('cancelAnimationFrame', () => {
    // simplified: just clear all pending
  });
}

/** Flush all pending requestAnimationFrame callbacks */
function flushRAF() {
  const cbs = [...pendingRAFCallbacks];
  pendingRAFCallbacks = [];
  for (const cb of cbs) cb(performance.now());
}

// ─── Tests ────────────────────────────────────────────────

describe('createRenderer', () => {
  let container: HTMLDivElement;
  let renderer: RendererInstance;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    mockRAF();

    container = document.createElement('div');
    mockLayout(container, 400, 300);
    document.body.appendChild(container);
  });

  afterEach(() => {
    renderer?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('creates root DOM structure', () => {
    const grid = createGrid({ data: makeRows(10), columns });
    renderer = createRenderer({ container, grid });

    const root = container.querySelector('.gs-grid');
    expect(root).toBeTruthy();
    expect(root!.querySelector('.gs-header')).toBeTruthy();
    expect(root!.querySelector('.gs-viewport')).toBeTruthy();
    expect(root!.querySelector('.gs-canvas')).toBeTruthy();
  });

  it('renders header cells for each visible column', () => {
    const grid = createGrid({ data: makeRows(10), columns });
    renderer = createRenderer({ container, grid });

    const headerCells = container.querySelectorAll('.gs-header-cell');
    expect(headerCells).toHaveLength(3);
    expect(headerCells[0].textContent).toBe('Name');
    expect(headerCells[1].textContent).toBe('Age');
    expect(headerCells[2].textContent).toBe('City');
  });

  it('does not render header cells for hidden columns', () => {
    const colsWithHidden: ColumnDef[] = [
      ...columns,
      { id: 'hidden', header: 'Hidden', visible: false },
    ];
    const grid = createGrid({ data: makeRows(10), columns: colsWithHidden });
    renderer = createRenderer({ container, grid });

    const headerCells = container.querySelectorAll('.gs-header-cell');
    expect(headerCells).toHaveLength(3); // hidden column excluded
  });

  it('sets canvas height based on total rows', () => {
    const grid = createGrid({ data: makeRows(100), columns });
    renderer = createRenderer({ container, grid, rowHeight: 32 });

    const canvas = container.querySelector('.gs-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('3200px'); // 100 * 32
  });

  it('renders only visible rows (not all data rows)', () => {
    const grid = createGrid({ data: makeRows(10000), columns });
    renderer = createRenderer({ container, grid, rowHeight: 32, overscan: 2 });

    const rows = container.querySelectorAll('.gs-row');
    // With 300px container - 32px header = 268px viewport
    // Even with jsdom, should be far fewer than 10000
    expect(rows.length).toBeLessThan(50);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('renders cell values correctly', () => {
    const grid = createGrid({
      data: [{ name: 'Alice', age: 30, city: 'Seoul' }],
      columns,
    });
    renderer = createRenderer({ container, grid });

    const cells = container.querySelectorAll('.gs-cell');
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain('Alice');
    expect(texts).toContain('30');
    expect(texts).toContain('Seoul');
  });

  it('renders null/undefined as empty string', () => {
    const grid = createGrid({
      data: [{ name: null, age: undefined, city: 'Seoul' }],
      columns,
    });
    renderer = createRenderer({ container, grid });

    const cells = container.querySelectorAll('.gs-cell');
    expect(cells[0].textContent).toBe('');
    expect(cells[1].textContent).toBe('');
  });

  it('updates when grid data changes', () => {
    const grid = createGrid({ data: makeRows(5), columns });
    renderer = createRenderer({ container, grid });

    let cells = container.querySelectorAll('.gs-cell');
    expect(cells[0].textContent).toBe('User 0');

    grid.setCell(0, 'name', 'Updated');
    flushRAF();

    cells = container.querySelectorAll('.gs-cell');
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain('Updated');
  });

  it('updates when columns change', () => {
    const grid = createGrid({ data: makeRows(5), columns });
    renderer = createRenderer({ container, grid });

    grid.setColumns([{ id: 'name', header: 'Full Name', width: 200 }]);
    flushRAF();

    const headerCells = container.querySelectorAll('.gs-header-cell');
    expect(headerCells).toHaveLength(1);
    expect(headerCells[0].textContent).toBe('Full Name');
  });

  it('updates row count when data is replaced', () => {
    const grid = createGrid({ data: makeRows(10), columns });
    renderer = createRenderer({ container, grid, rowHeight: 32 });

    grid.setData(makeRows(50));
    flushRAF();

    const canvas = container.querySelector('.gs-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('1600px'); // 50 * 32
  });

  it('refresh() forces a full re-render', () => {
    const grid = createGrid({ data: makeRows(5), columns });
    renderer = createRenderer({ container, grid });

    const rowsBefore = container.querySelectorAll('.gs-row').length;
    renderer.refresh();
    const rowsAfter = container.querySelectorAll('.gs-row').length;

    expect(rowsAfter).toBe(rowsBefore);
  });

  it('destroy() removes all DOM elements', () => {
    const grid = createGrid({ data: makeRows(5), columns });
    renderer = createRenderer({ container, grid });

    expect(container.querySelector('.gs-grid')).toBeTruthy();

    renderer.destroy();
    renderer = undefined!;

    expect(container.querySelector('.gs-grid')).toBeNull();
  });

  it('destroy() is idempotent', () => {
    const grid = createGrid({ data: makeRows(5), columns });
    renderer = createRenderer({ container, grid });

    renderer.destroy();
    // Second call should not throw
    renderer.destroy();
    renderer = undefined!;
  });

  it('applies cell decorations', () => {
    const grid = createGrid({
      data: [{ name: 'Alice', age: 30, city: 'Seoul' }],
      columns,
      plugins: [
        {
          name: 'test-decorator',
          init(ctx) {
            ctx.addCellDecorator(({ col }) => {
              if (col === 'name') {
                return { className: 'highlight', attributes: { 'data-test': 'yes' } };
              }
              return null;
            });
          },
        },
      ],
    });
    renderer = createRenderer({ container, grid });

    const highlightedCells = container.querySelectorAll('.gs-cell.highlight');
    expect(highlightedCells).toHaveLength(1);
    expect(highlightedCells[0].getAttribute('data-test')).toBe('yes');
  });

  it('handles sort changes by re-rendering', () => {
    const grid = createGrid({
      data: [
        { name: 'Bob', age: 25, city: 'Tokyo' },
        { name: 'Alice', age: 30, city: 'Seoul' },
      ],
      columns: [
        { id: 'name', header: 'Name', width: 120, sortable: true },
        { id: 'age', header: 'Age', width: 80 },
      ],
    });
    renderer = createRenderer({ container, grid });

    grid.sortState.set([{ columnId: 'name', direction: 'asc' }]);
    flushRAF();

    const rows = container.querySelectorAll('.gs-row');
    const firstRowCells = rows[0]?.querySelectorAll('.gs-cell');
    expect(firstRowCells?.[0]?.textContent).toBe('Alice');
  });

  it('handles filter changes by updating canvas height', () => {
    const grid = createGrid({
      data: makeRows(100),
      columns,
    });
    renderer = createRenderer({ container, grid, rowHeight: 32 });

    const canvasBefore = container.querySelector('.gs-canvas') as HTMLElement;
    expect(canvasBefore.style.height).toBe('3200px');

    grid.filterState.set([{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);
    flushRAF();

    const canvasAfter = container.querySelector('.gs-canvas') as HTMLElement;
    // ~50 rows match (even indices)
    const height = parseInt(canvasAfter.style.height, 10);
    expect(height).toBeLessThan(3200);
    expect(height).toBeGreaterThan(0);
  });

  it('handles empty data (0 rows)', () => {
    const grid = createGrid({ data: [], columns });
    renderer = createRenderer({ container, grid });

    const rows = container.querySelectorAll('.gs-row');
    expect(rows).toHaveLength(0);

    const canvas = container.querySelector('.gs-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('0px');
  });

  it('respects custom rowHeight', () => {
    const grid = createGrid({ data: makeRows(10), columns });
    renderer = createRenderer({ container, grid, rowHeight: 48 });

    const canvas = container.querySelector('.gs-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('480px'); // 10 * 48
  });

  it('respects custom headerHeight', () => {
    const grid = createGrid({ data: makeRows(10), columns });
    renderer = createRenderer({ container, grid, headerHeight: 40 });

    const header = container.querySelector('.gs-header') as HTMLElement;
    expect(header.style.height).toBe('40px');
  });
});
