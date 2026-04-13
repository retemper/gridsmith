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
  const { columns: initialColumns, plugins: initialPlugins = [] } = options;

  // Copy-on-init per RFC-001: shallow copy each row to avoid mutating caller's objects
  let data: Row[] = options.data.map((row) => ({ ...row }));

  // Reactive state
  const columns = signal<ColumnDef[]>([...initialColumns]);
  const sortState = signal<SortState>([]);
  const filterState = signal<FilterState>([]);

  // Event bus
  const events = createEventBus<GridEvents>();

  // Index map: recomputed when sort/filter/data changes
  const dataVersion = signal(0);
  const indexMap = computed(() => {
    dataVersion.get(); // track data changes
    return buildIndexMap(data, sortState.get(), filterState.get());
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
    sortState,
    filterState,
    indexMap,

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
      columns.set([...newColumns]);
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
