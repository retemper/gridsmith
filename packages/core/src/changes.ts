import type { CellChange, CellValue, ChangesPluginApi, ColumnDef, GridPlugin } from './types';

const key = (dataIndex: number, columnId: string): string => `${dataIndex}:${columnId}`;

// `Object.is` treats two `Date` instances with the same epoch as unequal,
// which would leave a cell "dirty" even after the user restored a semantically
// identical date. Matches the rule validation.ts uses for the same reason.
function valuesEqual(a: CellValue, b: CellValue): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

interface DirtyEntry {
  dataIndex: number;
  columnId: string;
  originalValue: CellValue;
  currentValue: CellValue;
}

function toCellChange(entry: DirtyEntry): CellChange {
  return {
    row: entry.dataIndex,
    col: entry.columnId,
    oldValue: entry.originalValue,
    newValue: entry.currentValue,
  };
}

export function createChangesPlugin(): GridPlugin {
  // Keyed by `${dataIndex}:${columnId}` so entries are stable across sort/filter
  // and round-trip the same way validation's error map does.
  const dirty = new Map<string, DirtyEntry>();

  const plugin: GridPlugin = {
    name: 'changes',

    init(ctx) {
      const grid = ctx.grid;

      const snapshot = (): CellChange[] => {
        const out: CellChange[] = [];
        for (const entry of dirty.values()) out.push(toCellChange(entry));
        return out;
      };

      const emitUpdate = (): void => {
        ctx.events.emit('changes:update', { dirty: snapshot() });
      };

      const unsubData = ctx.events.on('data:change', ({ changes }) => {
        let changed = false;
        for (const change of changes) {
          const entryKey = key(change.row, change.col);
          const existing = dirty.get(entryKey);
          if (existing) {
            // Preserve the very first `oldValue`; only the latest write wins
            // on the new side. If that lands us back at the original, the
            // cell is no longer dirty — drop the entry so the indicator and
            // `getDirty()` stay accurate.
            if (valuesEqual(existing.originalValue, change.newValue)) {
              dirty.delete(entryKey);
              changed = true;
            } else if (!valuesEqual(existing.currentValue, change.newValue)) {
              existing.currentValue = change.newValue;
              changed = true;
            }
          } else {
            // First write at this cell since the last commit/revert. The
            // event's `oldValue` is our baseline.
            if (valuesEqual(change.oldValue, change.newValue)) continue;
            dirty.set(entryKey, {
              dataIndex: change.row,
              columnId: change.col,
              originalValue: change.oldValue,
              currentValue: change.newValue,
            });
            changed = true;
          }
        }
        if (changed) emitUpdate();
      });

      // A wholesale `setData` invalidates every stored data-index. Drop the
      // dirty set — the new rows have no relationship to the recorded edits.
      const unsubRows = ctx.events.on('data:rowsUpdate', () => {
        if (dirty.size === 0) return;
        dirty.clear();
        emitUpdate();
      });

      // If a column disappears from the leaf set, its dirty entries are stale
      // (the field no longer exists on the row). Mirror history's approach:
      // only react when the *set* of ids changed, not pure reorders.
      let lastColumnIds = columnIdSet(grid.columns.peek());
      const unsubCols = ctx.events.on('columns:update', ({ columns }) => {
        const nextIds = columnIdSet(columns);
        if (nextIds === lastColumnIds) return;
        lastColumnIds = nextIds;
        const live = new Set(columns.map((c: ColumnDef) => c.id));
        let changed = false;
        for (const [k, entry] of Array.from(dirty.entries())) {
          if (!live.has(entry.columnId)) {
            dirty.delete(k);
            changed = true;
          }
        }
        if (changed) emitUpdate();
      });

      const safeViewToData = (rowIndex: number): number | null => {
        const map = grid.indexMap.get();
        if (rowIndex < 0 || rowIndex >= map.length) return null;
        return map.viewToData(rowIndex);
      };

      const api: ChangesPluginApi = {
        getDirty() {
          return snapshot();
        },

        isDirty(rowIndex, columnId) {
          const dataIndex = safeViewToData(rowIndex);
          if (dataIndex === null) return false;
          return dirty.has(key(dataIndex, columnId));
        },

        commit() {
          if (dirty.size === 0) {
            ctx.events.emit('changes:commit', { changes: [] });
            return;
          }
          const committed = snapshot();
          dirty.clear();
          ctx.events.emit('changes:commit', { changes: committed });
          emitUpdate();
        },

        revert() {
          if (dirty.size === 0) {
            ctx.events.emit('changes:revert', { changes: [] });
            return;
          }
          // Snapshot first: the writes below will fire `data:change`, which
          // mutates the dirty map in-flight (cells with `newValue ===
          // originalValue` self-evict). The snapshot captures what we
          // intended to revert for the emitted event payload.
          const reverted = snapshot();
          grid.batchUpdate(() => {
            for (const change of reverted) {
              grid.setCellByDataIndex(change.row, change.col, change.oldValue);
            }
          });
          // The `data:change` handler should have cleared the matching entries
          // as each write landed. Anything lingering is a write whose oldValue
          // was rejected (e.g. a column pinned to a computed value); clear it
          // so the API stays internally consistent.
          if (dirty.size > 0) {
            dirty.clear();
            emitUpdate();
          }
          ctx.events.emit('changes:revert', { changes: reverted });
        },
      };

      ctx.expose('changes', api);

      // Cells in the dirty set pick up `gs-cell--dirty` so the default stylesheet
      // (or any consumer CSS) can render the corner indicator.
      ctx.addCellDecorator(({ row, col }) => {
        const dataIndex = safeViewToData(row);
        if (dataIndex === null) return null;
        if (!dirty.has(key(dataIndex, col))) return null;
        return { className: 'gs-cell--dirty' };
      });

      return () => {
        unsubData();
        unsubRows();
        unsubCols();
        dirty.clear();
      };
    },
  };

  return plugin;
}

function columnIdSet(cols: readonly { id: string }[]): string {
  return cols
    .map((c) => c.id)
    .sort()
    .join('\u0000');
}

export type { ChangesPluginApi };
