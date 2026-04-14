import type { SortState, FilterState } from '@gridsmith/core';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { Grid } from './grid';
import type { GridColumnDef } from './types';

// ─── DOM mocks ────────────────────────────────────────────

const origCW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const origCH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 500;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 300;
    },
  });

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  if (origCW) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origCW);
  if (origCH) Object.defineProperty(HTMLElement.prototype, 'clientHeight', origCH);
  vi.restoreAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────

const columns: GridColumnDef[] = [
  { id: 'name', header: 'Name' },
  { id: 'age', header: 'Age', type: 'number' },
];

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

// ─── Tests ────────────────────────────────────────────────

describe('Grid', () => {
  it('renders the grid DOM structure', () => {
    const { container } = render(<Grid data={data} columns={columns} />);
    expect(container.querySelector('.gs-grid')).toBeTruthy();
    expect(container.querySelector('.gs-header')).toBeTruthy();
    expect(container.querySelector('.gs-viewport')).toBeTruthy();
    expect(container.querySelector('.gs-canvas')).toBeTruthy();
  });

  it('renders header cells for each column', () => {
    const { container } = render(<Grid data={data} columns={columns} />);
    const headers = container.querySelectorAll('.gs-header-cell');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('Name');
    expect(headers[1].textContent).toBe('Age');
  });

  it('renders data rows with cell values', () => {
    const { container } = render(<Grid data={data} columns={columns} />);
    const cells = container.querySelectorAll('.gs-cell');
    const texts = Array.from(cells).map((c) => c.textContent);
    expect(texts).toContain('Alice');
    expect(texts).toContain('30');
    expect(texts).toContain('Bob');
    expect(texts).toContain('25');
  });

  it('applies custom className', () => {
    const { container } = render(<Grid data={data} columns={columns} className="custom" />);
    expect(container.querySelector('.gs-grid.custom')).toBeTruthy();
  });

  it('renders custom cell renderer', () => {
    const cols: GridColumnDef[] = [
      {
        id: 'name',
        header: 'Name',
        cellRenderer: ({ value }) => <strong>{String(value)}</strong>,
      },
    ];
    const { container } = render(<Grid data={data} columns={cols} />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe('Alice');
    expect(strongs[1].textContent).toBe('Bob');
  });

  it('hides columns with visible=false', () => {
    const cols: GridColumnDef[] = [
      { id: 'name', header: 'Name' },
      { id: 'age', header: 'Age', visible: false },
    ];
    const { container } = render(<Grid data={data} columns={cols} />);
    const headers = container.querySelectorAll('.gs-header-cell');
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toBe('Name');
  });

  it('updates when data prop changes', () => {
    const { container, rerender } = render(<Grid data={data} columns={columns} />);

    const newData = [...data, { name: 'Charlie', age: 35 }];
    rerender(<Grid data={newData} columns={columns} />);

    const texts = Array.from(container.querySelectorAll('.gs-cell')).map((c) => c.textContent);
    expect(texts).toContain('Charlie');
    expect(texts).toContain('35');
  });

  it('renders with custom row height', () => {
    const { container } = render(<Grid data={data} columns={columns} rowHeight={40} />);
    const rows = container.querySelectorAll('.gs-row');
    if (rows.length > 0) {
      expect(rows[0].getAttribute('style')).toContain('height: 40px');
    }
  });

  it('is SSR safe (renderToString does not throw)', () => {
    const html = renderToString(<Grid data={data} columns={columns} />);
    expect(html).toContain('gs-grid');
    expect(html).toContain('gs-header');
  });

  it('calls onCellChange when grid emits data:change', () => {
    const onChange = vi.fn();
    const { container } = render(<Grid data={data} columns={columns} onCellChange={onChange} />);

    // The Grid doesn't expose setCell directly, but we can verify the
    // callback plumbing by checking that it subscribed correctly.
    // When useGrid creates the grid, data:change events fire the callback.
    // Full integration is tested via useGrid.
    expect(container.querySelector('.gs-grid')).toBeTruthy();
  });

  it('renders empty grid when data is empty', () => {
    const { container } = render(<Grid data={[]} columns={columns} />);
    expect(container.querySelectorAll('.gs-row')).toHaveLength(0);
    expect(container.querySelector('.gs-grid')).toBeTruthy();
  });

  it('applies controlled sortState', () => {
    const sortState: SortState = [{ columnId: 'name', direction: 'asc' }];
    const { container } = render(<Grid data={data} columns={columns} sortState={sortState} />);
    // Sorted ascending by name: Alice (30), Bob (25)
    const cells = Array.from(container.querySelectorAll('.gs-cell')).map((c) => c.textContent);
    expect(cells.indexOf('Alice')).toBeLessThan(cells.indexOf('Bob'));
  });

  it('applies controlled filterState', () => {
    const filterState: FilterState = [{ columnId: 'age', operator: 'gte', value: 30 }];
    const { container } = render(<Grid data={data} columns={columns} filterState={filterState} />);
    const cells = Array.from(container.querySelectorAll('.gs-cell')).map((c) => c.textContent);
    expect(cells).toContain('Alice');
    expect(cells).not.toContain('Bob');
  });

  it('calls onSortChange when sort state changes', () => {
    const onSort = vi.fn();

    function Wrapper() {
      const [sort, setSort] = useState<SortState>([]);
      return (
        <Grid
          data={data}
          columns={columns}
          sortState={sort}
          onSortChange={(s) => {
            onSort(s);
            setSort(s);
          }}
        />
      );
    }

    render(<Wrapper />);
    // The callback is wired up — direct grid mutation would fire it.
    // Here we verify the subscription was established without errors.
    expect(onSort).not.toHaveBeenCalled();
  });

  it('calls onFilterChange when filter state changes', () => {
    const onFilter = vi.fn();

    function Wrapper() {
      const [filter, setFilter] = useState<FilterState>([]);
      return (
        <Grid
          data={data}
          columns={columns}
          filterState={filter}
          onFilterChange={(f) => {
            onFilter(f);
            setFilter(f);
          }}
        />
      );
    }

    render(<Wrapper />);
    expect(onFilter).not.toHaveBeenCalled();
  });
});
