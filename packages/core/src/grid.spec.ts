import { describe, expect, it, vi } from 'vitest';

import { createGrid } from './grid';
import type { Row, ColumnDef, GridPlugin } from './types';

const sampleColumns: ColumnDef[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age', header: 'Age', type: 'number' },
  { id: 'city', header: 'City', type: 'text' },
];

const sampleData: Row[] = [
  { name: 'Alice', age: 30, city: 'Seoul' },
  { name: 'Bob', age: 25, city: 'Tokyo' },
  { name: 'Charlie', age: 35, city: 'Seoul' },
];

describe('createGrid', () => {
  it('initializes with data and columns', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });

    expect(grid.data).toHaveLength(3);
    expect(grid.columns.get()).toHaveLength(3);
    expect(grid.rowCount).toBe(3);
  });

  it('shallow copies initial data (does not mutate original)', () => {
    const original = [...sampleData];
    const grid = createGrid({ data: original, columns: sampleColumns });

    grid.setCell(0, 'name', 'Modified');
    expect(original[0]!.name).toBe('Alice'); // original unchanged
  });

  it('emits ready event on creation', () => {
    const fn = vi.fn();
    const plugin: GridPlugin = {
      name: 'ready-listener',
      init(ctx) {
        ctx.events.on('ready', fn);
      },
    };

    createGrid({ data: [], columns: [], plugins: [plugin] });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('cell operations', () => {
  it('getCell reads by view index', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    expect(grid.getCell(0, 'name')).toBe('Alice');
    expect(grid.getCell(1, 'age')).toBe(25);
  });

  it('setCell updates in place and emits event', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('data:change', fn);

    grid.setCell(0, 'name', 'Alicia');
    expect(grid.getCell(0, 'name')).toBe('Alicia');
    expect(fn).toHaveBeenCalledWith({
      changes: [{ row: 0, col: 'name', oldValue: 'Alice', newValue: 'Alicia' }],
    });
  });

  it('setCell does not emit when value is the same', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('data:change', fn);

    grid.setCell(0, 'name', 'Alice');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('data and column updates', () => {
  it('setData replaces data and emits event', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('data:rowsUpdate', fn);

    const newData = [{ name: 'Dave', age: 40, city: 'Busan' }];
    grid.setData(newData);

    expect(grid.data).toHaveLength(1);
    expect(grid.getCell(0, 'name')).toBe('Dave');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('setColumns replaces columns and emits event', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('columns:update', fn);

    const newCols: ColumnDef[] = [{ id: 'name', header: 'Full Name' }];
    grid.setColumns(newCols);

    expect(grid.columns.get()).toHaveLength(1);
    expect(grid.columns.get()[0]!.header).toBe('Full Name');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('sort', () => {
  it('sorts data by column ascending', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.sortState.set([{ columnId: 'age', direction: 'asc' }]);

    expect(grid.getCell(0, 'name')).toBe('Bob'); // age 25
    expect(grid.getCell(1, 'name')).toBe('Alice'); // age 30
    expect(grid.getCell(2, 'name')).toBe('Charlie'); // age 35
  });

  it('sorts data descending', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.sortState.set([{ columnId: 'age', direction: 'desc' }]);

    expect(grid.getCell(0, 'name')).toBe('Charlie'); // age 35
    expect(grid.getCell(2, 'name')).toBe('Bob'); // age 25
  });

  it('supports multi-column sort', () => {
    const data: Row[] = [
      { name: 'Alice', age: 30, city: 'Seoul' },
      { name: 'Bob', age: 30, city: 'Tokyo' },
      { name: 'Charlie', age: 25, city: 'Seoul' },
    ];
    const grid = createGrid({ data, columns: sampleColumns });
    grid.sortState.set([
      { columnId: 'age', direction: 'asc' },
      { columnId: 'name', direction: 'asc' },
    ]);

    expect(grid.getCell(0, 'name')).toBe('Charlie'); // age 25
    expect(grid.getCell(1, 'name')).toBe('Alice'); // age 30, A < B
    expect(grid.getCell(2, 'name')).toBe('Bob'); // age 30, B
  });
});

describe('filter', () => {
  it('filters by equality', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.filterState.set([{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);

    expect(grid.rowCount).toBe(2);
    expect(grid.getCell(0, 'name')).toBe('Alice');
    expect(grid.getCell(1, 'name')).toBe('Charlie');
  });

  it('filters by contains', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.filterState.set([{ columnId: 'name', operator: 'contains', value: 'li' }]);

    expect(grid.rowCount).toBe(2); // Alice, Charlie
  });

  it('filters by numeric comparison', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.filterState.set([{ columnId: 'age', operator: 'gte', value: 30 }]);

    expect(grid.rowCount).toBe(2); // Alice (30), Charlie (35)
  });

  it('combines sort and filter', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.filterState.set([{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);
    grid.sortState.set([{ columnId: 'age', direction: 'desc' }]);

    expect(grid.rowCount).toBe(2);
    expect(grid.getCell(0, 'name')).toBe('Charlie'); // age 35
    expect(grid.getCell(1, 'name')).toBe('Alice'); // age 30
  });
});

describe('indexMap', () => {
  it('maps view to data indices', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.sortState.set([{ columnId: 'age', direction: 'asc' }]);

    const map = grid.indexMap.get();
    // Bob (age 25) is at data index 1, view index 0
    expect(map.viewToData(0)).toBe(1);
    expect(map.dataToView(1)).toBe(0);
  });

  it('dataToView returns null for filtered-out rows', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.filterState.set([{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);

    const map = grid.indexMap.get();
    expect(map.dataToView(1)).toBeNull(); // Bob is in Tokyo, filtered out
  });

  it('throws on out-of-range viewToData', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    expect(() => grid.indexMap.get().viewToData(999)).toThrow(RangeError);
    expect(() => grid.indexMap.get().viewToData(-1)).toThrow(RangeError);
  });
});

describe('batchUpdate', () => {
  it('batches multiple changes into one notification cycle', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const changeFn = vi.fn();
    grid.events.on('data:change', changeFn);

    grid.batchUpdate(() => {
      grid.setCell(0, 'name', 'X');
      grid.setCell(1, 'name', 'Y');
    });

    // Each setCell emits independently, but signal notifications are batched
    expect(changeFn).toHaveBeenCalledTimes(2);
  });
});

describe('subscribe helper', () => {
  it('subscribes and unsubscribes to events', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    const unsub = grid.subscribe('data:change', fn);

    grid.setCell(0, 'name', 'Test');
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    grid.setCell(0, 'name', 'Test2');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('destroy', () => {
  it('emits destroy event and cleans up', () => {
    const cleanupFn = vi.fn();
    const plugin: GridPlugin = {
      name: 'cleanup-test',
      init: () => cleanupFn,
    };
    const grid = createGrid({ data: sampleData, columns: sampleColumns, plugins: [plugin] });

    const destroyFn = vi.fn();
    grid.events.on('destroy', destroyFn);

    grid.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it('is idempotent', () => {
    const grid = createGrid({ data: [], columns: [] });
    grid.destroy();
    grid.destroy(); // should not throw
  });

  it('throws on getCell after destroy', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.destroy();
    expect(() => grid.getCell(0, 'name')).toThrow(/destroyed/);
  });

  it('throws on setCell after destroy', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.destroy();
    expect(() => grid.setCell(0, 'name', 'X')).toThrow(/destroyed/);
  });

  it('throws on setData after destroy', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.destroy();
    expect(() => grid.setData([])).toThrow(/destroyed/);
  });

  it('throws on setColumns after destroy', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.destroy();
    expect(() => grid.setColumns([])).toThrow(/destroyed/);
  });
});

describe('resizeColumn', () => {
  it('updates the column width', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.resizeColumn('name', 200);

    const cols = grid.columns.get();
    expect(cols.find((c) => c.id === 'name')!.width).toBe(200);
  });

  it('emits column:resize (and skips columns:update since leaves are structurally unchanged)', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const resizeFn = vi.fn();
    const updateFn = vi.fn();
    grid.events.on('column:resize', resizeFn);
    grid.events.on('columns:update', updateFn);

    grid.resizeColumn('age', 150);
    expect(resizeFn).toHaveBeenCalledWith({ columnId: 'age', width: 150 });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it('clamps to minWidth and maxWidth', () => {
    const cols: ColumnDef[] = [{ id: 'a', header: 'A', minWidth: 50, maxWidth: 300, width: 100 }];
    const grid = createGrid({ data: [], columns: cols });

    grid.resizeColumn('a', 10);
    expect(grid.columns.get()[0]!.width).toBe(50);

    grid.resizeColumn('a', 500);
    expect(grid.columns.get()[0]!.width).toBe(300);
  });

  it('uses default minWidth of 30 when not specified', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.resizeColumn('name', 5);
    expect(grid.columns.get().find((c) => c.id === 'name')!.width).toBe(30);
  });

  it('does not emit when width unchanged', () => {
    const cols: ColumnDef[] = [{ id: 'a', header: 'A', width: 100 }];
    const grid = createGrid({ data: [], columns: cols });
    const fn = vi.fn();
    grid.events.on('column:resize', fn);

    grid.resizeColumn('a', 100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores unknown column IDs', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('column:resize', fn);

    grid.resizeColumn('unknown', 200);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('reorderColumn', () => {
  it('moves a column from one index to another', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    grid.reorderColumn(0, 2);

    const cols = grid.columns.get();
    expect(cols.map((c) => c.id)).toEqual(['age', 'city', 'name']);
  });

  it('emits column:reorder and columns:update events', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const reorderFn = vi.fn();
    const updateFn = vi.fn();
    grid.events.on('column:reorder', reorderFn);
    grid.events.on('columns:update', updateFn);

    grid.reorderColumn(2, 0);
    expect(reorderFn).toHaveBeenCalledWith({
      columnId: 'city',
      fromIndex: 2,
      toIndex: 0,
    });
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  it('no-ops when from === to', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('column:reorder', fn);

    grid.reorderColumn(1, 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('no-ops for out-of-range indices', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('column:reorder', fn);

    grid.reorderColumn(-1, 0);
    grid.reorderColumn(0, 99);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('pinned rows', () => {
  it('initializes with pinnedTopRows and pinnedBottomRows', () => {
    const grid = createGrid({
      data: sampleData,
      columns: sampleColumns,
      pinnedTopRows: [0],
      pinnedBottomRows: [2],
    });
    expect(grid.pinnedTopRows.get()).toEqual([0]);
    expect(grid.pinnedBottomRows.get()).toEqual([2]);
  });

  it('defaults to empty arrays', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    expect(grid.pinnedTopRows.get()).toEqual([]);
    expect(grid.pinnedBottomRows.get()).toEqual([]);
  });

  it('updates pinned rows via setters', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });

    grid.setPinnedTopRows([0, 1]);
    expect(grid.pinnedTopRows.get()).toEqual([0, 1]);

    grid.setPinnedBottomRows([2]);
    expect(grid.pinnedBottomRows.get()).toEqual([2]);
  });
});

describe('grouped columns', () => {
  const groupedColumns: ColumnDef[] = [
    { id: 'name', header: 'Name', type: 'text' },
    {
      id: 'location',
      header: 'Location',
      children: [
        { id: 'city', header: 'City', type: 'text' },
        { id: 'country', header: 'Country', type: 'text' },
      ],
    },
  ];

  const groupedData: Row[] = [
    { name: 'Alice', city: 'Seoul', country: 'KR' },
    { name: 'Bob', city: 'Tokyo', country: 'JP' },
  ];

  it('exposes the tree via columnDefs and flat leaves via columns', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    expect(grid.columnDefs.get().map((c) => c.id)).toEqual(['name', 'location']);
    expect(grid.columns.get().map((c) => c.id)).toEqual(['name', 'city', 'country']);
  });

  it('allows cell operations on leaf columns', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    expect(grid.getCell(0, 'city')).toBe('Seoul');
    grid.setCell(1, 'country', 'Japan');
    expect(grid.getCell(1, 'country')).toBe('Japan');
  });

  it('sorts and filters on leaf columns', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    grid.sortState.set([{ columnId: 'city', direction: 'desc' }]);
    expect(grid.getCell(0, 'name')).toBe('Bob'); // Tokyo > Seoul
    grid.filterState.set([{ columnId: 'country', operator: 'eq', value: 'KR' }]);
    expect(grid.rowCount).toBe(1);
    expect(grid.getCell(0, 'name')).toBe('Alice');
  });

  it('resizeColumn updates the width on the leaf inside the tree', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    grid.resizeColumn('city', 150);
    const location = grid.columnDefs.get().find((c) => c.id === 'location');
    const city = location?.children?.find((c) => c.id === 'city');
    expect(city?.width).toBe(150);
    // Flat leaf view reflects the update.
    expect(grid.columns.get().find((c) => c.id === 'city')?.width).toBe(150);
  });

  it('emits columnDefs:update and column:resize but not columns:update on resize', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    const defsFn = vi.fn();
    const colsFn = vi.fn();
    const resizeFn = vi.fn();
    grid.events.on('columnDefs:update', defsFn);
    grid.events.on('columns:update', colsFn);
    grid.events.on('column:resize', resizeFn);

    grid.resizeColumn('city', 160);
    expect(defsFn).toHaveBeenCalledTimes(1);
    expect(resizeFn).toHaveBeenCalledTimes(1);
    // Leaf list is structurally unchanged; only widths changed.
    expect(colsFn).not.toHaveBeenCalled();
  });

  it('reorder is a no-op when the tree has groups', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fn = vi.fn();
    grid.events.on('column:reorder', fn);
    grid.reorderColumn(0, 1);
    expect(fn).not.toHaveBeenCalled();
    expect(grid.columnDefs.get().map((c) => c.id)).toEqual(['name', 'location']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('setColumns accepts a tree and re-derives leaves', () => {
    const grid = createGrid({ data: groupedData, columns: groupedColumns });
    const newCols: ColumnDef[] = [
      {
        id: 'group',
        header: 'Group',
        children: [
          { id: 'name', header: 'Name' },
          { id: 'city', header: 'City' },
        ],
      },
    ];
    grid.setColumns(newCols);
    expect(grid.columnDefs.get()[0].id).toBe('group');
    expect(grid.columns.get().map((c) => c.id)).toEqual(['name', 'city']);
  });

  it('pin propagates from group to leaves via the flat view', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g',
        header: 'G',
        pin: 'left',
        children: [{ id: 'a', header: 'A' }],
      },
    ];
    const grid = createGrid({ data: [], columns: cols });
    expect(grid.columns.get()[0].pin).toBe('left');
  });
});

describe('reactive state', () => {
  it('indexMap recomputes on sort change', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.indexMap.subscribe(fn);

    grid.sortState.set([{ columnId: 'age', direction: 'asc' }]);
    expect(fn).toHaveBeenCalled();
  });

  it('indexMap recomputes on filter change', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.indexMap.subscribe(fn);

    grid.filterState.set([{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);
    expect(fn).toHaveBeenCalled();
  });

  it('emits sort:change event when sortState changes', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('sort:change', fn);

    const sort = [{ columnId: 'age', direction: 'asc' as const }];
    grid.sortState.set(sort);
    expect(fn).toHaveBeenCalledWith({ sort });
  });

  it('emits filter:change event when filterState changes', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.events.on('filter:change', fn);

    const filter = [{ columnId: 'city', operator: 'eq' as const, value: 'Seoul' }];
    grid.filterState.set(filter);
    expect(fn).toHaveBeenCalledWith({ filter });
  });

  it('columns signal is subscribable', () => {
    const grid = createGrid({ data: sampleData, columns: sampleColumns });
    const fn = vi.fn();
    grid.columns.subscribe(fn);

    grid.setColumns([{ id: 'x', header: 'X' }]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
