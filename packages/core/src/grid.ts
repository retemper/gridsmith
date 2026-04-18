import { flattenColumns, setLeafWidth } from './column-group';
import { createEventBus } from './events';
import { buildIndexMap } from './index-map';
import { createPluginManager } from './plugin';
import { signal, computed, batch } from './signal';
import type { Unsubscribe } from './signal';
import type {
  GridOptions,
  GridInstance,
  GridEvents,
  Row,
  ColumnDef,
  CellValue,
  CellDecoration,
  SortState,
  FilterState,
} from './types';

export function createGrid(options: GridOptions): GridInstance {
  const {
    columns: initialColumns,
    plugins: initialPlugins = [],
    pinnedTopRows: initialPinnedTop = [],
    pinnedBottomRows: initialPinnedBottom = [],
  } = options;

  // Copy-on-init per RFC-001: shallow copy each row to avoid mutating caller's objects
  let data: Row[] = options.data.map((row) => ({ ...row }));

  // Reactive state
  // `columnDefs` holds the original tree (with `children`); `columns` holds
  // the flattened leaf list used by all data ops and layout.
  const columnDefs = signal<ColumnDef[]>([...initialColumns]);
  const columns = computed<ColumnDef[]>(() => flattenColumns(columnDefs.get()));
  const sortState = signal<SortState>([]);
  const filterState = signal<FilterState>([]);
  const pinnedTopRows = signal<number[]>([...initialPinnedTop]);
  const pinnedBottomRows = signal<number[]>([...initialPinnedBottom]);

  // Event bus
  const events = createEventBus<GridEvents>();

  // Index map: recomputed when sort/filter/data changes
  const dataVersion = signal(0);
  const indexMap = computed(() => {
    dataVersion.get(); // track data changes
    return buildIndexMap(data, sortState.get(), filterState.get(), columns.get());
  });

  // Emit events when sort/filter state changes
  sortState.subscribe((sort) => {
    events.emit('sort:change', { sort });
  });
  filterState.subscribe((filter) => {
    events.emit('filter:change', { filter });
  });

  // Plugin manager
  const pluginManager = createPluginManager(initialPlugins);

  let destroyed = false;

  const assertAlive = () => {
    if (destroyed) throw new Error('Grid instance has been destroyed');
  };

  const grid: GridInstance = {
    get data(): Row[] {
      return [...data];
    },

    columns,
    columnDefs,
    sortState,
    filterState,
    indexMap,
    pinnedTopRows,
    pinnedBottomRows,

    setPinnedTopRows(indices: number[]): void {
      assertAlive();
      pinnedTopRows.set([...indices]);
    },

    setPinnedBottomRows(indices: number[]): void {
      assertAlive();
      pinnedBottomRows.set([...indices]);
    },

    get rowCount() {
      return indexMap.get().length;
    },

    events,

    getCell(rowIndex: number, columnId: string): CellValue {
      assertAlive();
      const dataIndex = indexMap.get().viewToData(rowIndex);
      const row = data[dataIndex];
      if (!row) throw new RangeError(`Data index ${dataIndex} out of range`);
      return row[columnId];
    },

    setCell(rowIndex: number, columnId: string, value: CellValue): void {
      assertAlive();
      const dataIndex = indexMap.get().viewToData(rowIndex);
      const row = data[dataIndex];
      if (!row) throw new RangeError(`Data index ${dataIndex} out of range`);
      const oldValue = row[columnId];
      if (Object.is(oldValue, value)) return;

      row[columnId] = value;
      dataVersion.update((v) => v + 1);
      events.emit('data:change', {
        changes: [{ row: dataIndex, col: columnId, oldValue, newValue: value }],
      });
    },

    setData(newData: Row[]): void {
      assertAlive();
      data = newData.map((row) => ({ ...row }));
      dataVersion.update((v) => v + 1);
      events.emit('data:rowsUpdate', { data });
    },

    setColumns(newColumns: ColumnDef[]): void {
      assertAlive();
      const nextTree = [...newColumns];
      columnDefs.set(nextTree);
      events.emit('columnDefs:update', { columnDefs: nextTree });
      events.emit('columns:update', { columns: columns.get() });
    },

    resizeColumn(columnId: string, width: number): void {
      assertAlive();
      const leafs = columns.get();
      const leaf = leafs.find((c) => c.id === columnId);
      if (!leaf) return;
      const min = leaf.minWidth ?? 30;
      const max = leaf.maxWidth ?? Infinity;
      const clamped = Math.max(min, Math.min(max, width));
      if (leaf.width === clamped) return;

      const result = setLeafWidth(columnDefs.get(), columnId, clamped);
      if (!result.changed) return;
      columnDefs.set(result.columns);
      events.emit('column:resize', { columnId, width: clamped });
      events.emit('columnDefs:update', { columnDefs: result.columns });
      events.emit('columns:update', { columns: columns.get() });
    },

    reorderColumn(fromIndex: number, toIndex: number): void {
      assertAlive();
      const tree = columnDefs.get();
      // Reorder is only defined when the tree is flat. With header groups,
      // swapping siblings across groups would either break the tree or only
      // work within a single group — deferred to Phase 2.
      const hasGroups = tree.some((c) => c.children && c.children.length > 0);
      if (hasGroups) return;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= tree.length ||
        toIndex < 0 ||
        toIndex >= tree.length
      )
        return;
      const col = tree[fromIndex];
      const next = [...tree];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, col);
      columnDefs.set(next);
      events.emit('column:reorder', {
        columnId: col.id,
        fromIndex,
        toIndex,
      });
      events.emit('columnDefs:update', { columnDefs: next });
      events.emit('columns:update', { columns: columns.get() });
    },

    batchUpdate(fn: () => void): void {
      batch(fn);
    },

    getPlugin<T>(name: string): T | undefined {
      return pluginManager.getPlugin<T>(name);
    },

    getCellDecorations(row: number, col: string): CellDecoration[] {
      const value = grid.getCell(row, col);
      const result: CellDecoration[] = [];
      for (const decorator of pluginManager.decorators) {
        const decoration = decorator({ row, col, value });
        if (decoration) {
          result.push(decoration);
        }
      }
      return result;
    },

    subscribe<K extends keyof GridEvents & string>(
      event: K,
      handler: (payload: GridEvents[K]) => void,
    ): Unsubscribe {
      return events.on(event, handler);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      events.emit('destroy', undefined);
      pluginManager.destroyAll();
      events.removeAllListeners();
    },
  };

  // Initialize plugins after grid is constructed
  pluginManager.initAll(grid, events);
  events.emit('ready', undefined);

  return grid;
}
