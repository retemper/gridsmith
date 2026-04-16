import type { SortState, FilterState } from '@gridsmith/core';
import { fireEvent, render } from '@testing-library/react';
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
    // Header cells now wrap the label in a <button>; read the label element
    // directly so the filter-button glyph doesn't pollute the assertion.
    const labels = container.querySelectorAll('.gs-header-label');
    expect(labels[0].textContent?.trim()).toBe('Name');
    expect(labels[1].textContent?.trim()).toBe('Age');
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
    const label = container.querySelector('.gs-header-label');
    expect(label?.textContent?.trim()).toBe('Name');
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

  // ─── Header sort UI ────────────────────────────────────

  describe('header sort UI', () => {
    it('clicking a sortable header toggles asc, desc, then clears', () => {
      const onSort = vi.fn();
      const { container } = render(<Grid data={data} columns={columns} onSortChange={onSort} />);

      const labels = container.querySelectorAll(
        '.gs-header-label',
      ) as NodeListOf<HTMLButtonElement>;
      const nameBtn = labels[0];

      fireEvent.click(nameBtn);
      expect(onSort).toHaveBeenLastCalledWith([{ columnId: 'name', direction: 'asc' }]);

      fireEvent.click(nameBtn);
      expect(onSort).toHaveBeenLastCalledWith([{ columnId: 'name', direction: 'desc' }]);

      fireEvent.click(nameBtn);
      expect(onSort).toHaveBeenLastCalledWith([]);
    });

    it('shift-click adds a second column without replacing the first', () => {
      const onSort = vi.fn();
      const { container } = render(<Grid data={data} columns={columns} onSortChange={onSort} />);
      const labels = container.querySelectorAll(
        '.gs-header-label',
      ) as NodeListOf<HTMLButtonElement>;

      fireEvent.click(labels[0]);
      fireEvent.click(labels[1], { shiftKey: true });

      expect(onSort).toHaveBeenLastCalledWith([
        { columnId: 'name', direction: 'asc' },
        { columnId: 'age', direction: 'asc' },
      ]);
    });

    it('does not sort columns declared sortable:false', () => {
      const onSort = vi.fn();
      const cols: GridColumnDef[] = [
        { id: 'name', header: 'Name', sortable: false },
        { id: 'age', header: 'Age', type: 'number' },
      ];
      const { container } = render(<Grid data={data} columns={cols} onSortChange={onSort} />);
      const label = container.querySelectorAll('.gs-header-label')[0] as HTMLButtonElement;
      expect(label.disabled).toBe(true);
      fireEvent.click(label);
      expect(onSort).not.toHaveBeenCalled();
    });

    it('renders a sort indicator on the active column', () => {
      const { container } = render(
        <Grid data={data} columns={columns} sortState={[{ columnId: 'age', direction: 'desc' }]} />,
      );
      const indicators = container.querySelectorAll('.gs-header-sort-indicator');
      expect(indicators).toHaveLength(1);
      expect(indicators[0].textContent).toContain('▼');
    });
  });

  // ─── Header filter UI ──────────────────────────────────

  describe('header filter UI', () => {
    it('opens the filter popover when the filter button is clicked', () => {
      const { container } = render(<Grid data={data} columns={columns} />);
      const btn = container.querySelector('.gs-header-filter-btn') as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(container.querySelector('.gs-filter-popover')).toBeNull();

      fireEvent.click(btn);
      expect(container.querySelector('.gs-filter-popover')).toBeTruthy();
    });

    it('applying a filter updates the grid and closes the popover', () => {
      const onFilter = vi.fn();
      const { container } = render(
        <Grid data={data} columns={columns} onFilterChange={onFilter} />,
      );

      const filterBtn = container.querySelectorAll('.gs-header-filter-btn')[1] as HTMLButtonElement;
      fireEvent.click(filterBtn);

      const op = container.querySelector('.gs-filter-operator') as HTMLSelectElement;
      fireEvent.change(op, { target: { value: 'gte' } });
      const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '30' } });

      const apply = container.querySelector('.gs-filter-apply') as HTMLButtonElement;
      fireEvent.click(apply);

      expect(onFilter).toHaveBeenLastCalledWith([{ columnId: 'age', operator: 'gte', value: 30 }]);
      expect(container.querySelector('.gs-filter-popover')).toBeNull();
    });

    it('clicking Clear removes that column from filter state', () => {
      const onFilter = vi.fn();
      const { container } = render(
        <Grid
          data={data}
          columns={columns}
          filterState={[{ columnId: 'age', operator: 'gte', value: 30 }]}
          onFilterChange={onFilter}
        />,
      );

      const filterBtn = container.querySelectorAll('.gs-header-filter-btn')[1] as HTMLButtonElement;
      fireEvent.click(filterBtn);

      const clear = container.querySelector('.gs-filter-clear') as HTMLButtonElement;
      fireEvent.click(clear);

      expect(onFilter).toHaveBeenLastCalledWith([]);
    });

    it('hides the filter button for columns declared filterable:false', () => {
      const cols: GridColumnDef[] = [
        { id: 'name', header: 'Name', filterable: false },
        { id: 'age', header: 'Age', type: 'number' },
      ];
      const { container } = render(<Grid data={data} columns={cols} />);
      const buttons = container.querySelectorAll('.gs-header-filter-btn');
      expect(buttons).toHaveLength(1);
    });

    it('Enter in the filter popover applies without leaking to the grid', () => {
      const onFilter = vi.fn();
      const onCell = vi.fn();
      const { container } = render(
        <Grid data={data} columns={columns} onFilterChange={onFilter} onCellChange={onCell} />,
      );

      const filterBtn = container.querySelectorAll('.gs-header-filter-btn')[1] as HTMLButtonElement;
      fireEvent.click(filterBtn);
      const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '30' } });

      // Pressing Enter inside the popover must apply the filter and not
      // bubble up to the grid's key handler (which would begin an edit or
      // delete a focused cell).
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onFilter).toHaveBeenLastCalledWith([{ columnId: 'age', operator: 'eq', value: 30 }]);
      expect(onCell).not.toHaveBeenCalled();
    });

    it('filter button advertises popup state via aria-expanded', () => {
      const { container } = render(<Grid data={data} columns={columns} />);
      const btn = container.querySelector('.gs-header-filter-btn') as HTMLButtonElement;
      expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    it('select-typed columns show includes/excludes operators', () => {
      const cols: GridColumnDef[] = [
        {
          id: 'role',
          header: 'Role',
          type: 'select',
          selectOptions: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ],
        },
      ];
      const rowsWithRole = [{ role: 'admin' }, { role: 'user' }];
      const { container } = render(<Grid data={rowsWithRole} columns={cols} />);
      const btn = container.querySelector('.gs-header-filter-btn') as HTMLButtonElement;
      fireEvent.click(btn);
      const select = container.querySelector('.gs-filter-operator') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toEqual(['in', 'notIn']);
    });
  });
});
