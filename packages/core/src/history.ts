import type {
  CellChange,
  Command,
  GridInstance,
  GridPlugin,
  HistoryPluginApi,
  HistoryPluginOptions,
  SortState,
} from './types';

interface ColumnReorderRecord {
  columnId: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Bundle of mutations observed within a single transaction (or as a single
 * standalone event). Cell changes are merged across the transaction so the
 * recorded `oldValue` reflects the value before the transaction started, even
 * if the same cell was touched multiple times.
 */
interface PendingTx {
  cellChanges: CellChange[];
  sortBefore: SortState | null;
  sortAfter: SortState | null;
  reorders: ColumnReorderRecord[];
}

function emptyTx(): PendingTx {
  return { cellChanges: [], sortBefore: null, sortAfter: null, reorders: [] };
}

function cloneSort(sort: SortState): SortState {
  return sort.map((entry) => ({ ...entry }));
}

function sortEqual(a: SortState, b: SortState): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ea = a[i];
    const eb = b[i];
    if (
      ea.columnId !== eb.columnId ||
      ea.direction !== eb.direction ||
      ea.comparator !== eb.comparator
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Collapse repeated touches on the same cell so the command writes one value
 * per cell. Preserves the earliest `oldValue` and the latest `newValue`.
 * Drops entries that net to a no-op.
 */
function mergeCellChanges(changes: CellChange[]): CellChange[] {
  const map = new Map<string, CellChange>();
  for (const c of changes) {
    const key = `${c.row}\u0000${c.col}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, { row: c.row, col: c.col, oldValue: existing.oldValue, newValue: c.newValue });
    } else {
      map.set(key, { ...c });
    }
  }
  const out: CellChange[] = [];
  for (const c of map.values()) {
    if (Object.is(c.oldValue, c.newValue)) continue;
    out.push(c);
  }
  return out;
}

function makeCellsCommand(grid: GridInstance, changes: CellChange[]): Command {
  return {
    label: 'cells',
    redo() {
      grid.batchUpdate(() => {
        for (const c of changes) {
          grid.setCellByDataIndex(c.row, c.col, c.newValue);
        }
      });
    },
    undo() {
      grid.batchUpdate(() => {
        for (const c of changes) {
          grid.setCellByDataIndex(c.row, c.col, c.oldValue);
        }
      });
    },
  };
}

function makeSortCommand(grid: GridInstance, before: SortState, after: SortState): Command {
  return {
    label: 'sort',
    redo() {
      grid.sortState.set(cloneSort(after));
    },
    undo() {
      grid.sortState.set(cloneSort(before));
    },
  };
}

/**
 * Reverse of `reorderColumn(from, to)`: splice out at `to`, insert at `from`.
 * Holds for the splice-based implementation in `grid.ts`.
 */
function makeReorderCommand(grid: GridInstance, record: ColumnReorderRecord): Command {
  const { fromIndex, toIndex } = record;
  return {
    label: 'column:reorder',
    redo() {
      grid.reorderColumn(fromIndex, toIndex);
    },
    undo() {
      grid.reorderColumn(toIndex, fromIndex);
    },
  };
}

/**
 * Compose multiple commands into one undoable unit. Redo runs in original
 * order; undo runs in reverse so a paste-then-sort batch unwinds correctly.
 */
function makeCompositeCommand(parts: Command[]): Command {
  return {
    label: 'composite',
    redo() {
      for (const cmd of parts) cmd.redo();
    },
    undo() {
      for (let i = parts.length - 1; i >= 0; i--) parts[i].undo();
    },
  };
}

export function createHistoryPlugin(options: HistoryPluginOptions = {}): GridPlugin {
  let maxSize = Math.max(1, options.maxSize ?? 100);

  const undoStack: Command[] = [];
  const redoStack: Command[] = [];

  // True while the plugin is replaying a command. All event listeners check
  // this and skip recording — otherwise the very act of undo would push a
  // mirror command onto the stack.
  let isApplying = false;

  // Refcount for external callers that need to write data without polluting
  // the undo stack (async-data loaders, server reconciliation, etc.). When
  // nonzero, every `data:change` / `sort:change` / `column:reorder` listener
  // short-circuits the same way it does during undo replay.
  let suppressDepth = 0;

  // Open transactions are buffered into `pending`. When the outermost
  // transaction ends we flush exactly one composite command. Standalone
  // mutations (no transaction wrapper) flush immediately at depth 0.
  let txDepth = 0;
  let pending: PendingTx = emptyTx();

  const plugin: GridPlugin = {
    name: 'history',

    init(ctx) {
      const grid = ctx.grid;

      // Snapshot of the latest committed sort. We diff against this on each
      // change to know what to record as `before`.
      let lastSort = cloneSort(grid.sortState.peek());

      // Snapshot of the leaf column id set. `columns:update` fires for both
      // reorders and wholesale `setColumns` calls; we only invalidate history
      // when the *set* of columns changes (add/remove), not on reorders.
      const columnIdSet = (cols: { id: string }[]) =>
        cols
          .map((c) => c.id)
          .sort()
          .join('\u0000');
      let lastColumnIds = columnIdSet(grid.columns.peek());

      const emitChange = () => {
        ctx.events.emit('history:change', {
          canUndo: undoStack.length > 0,
          canRedo: redoStack.length > 0,
          undoSize: undoStack.length,
          redoSize: redoStack.length,
        });
      };

      const pushCommand = (cmd: Command) => {
        undoStack.push(cmd);
        // Trim from the front so the most recent `maxSize` entries survive.
        // A while-loop tolerates mid-flight `setMaxSize` shrinks too.
        while (undoStack.length > maxSize) undoStack.shift();
        if (redoStack.length > 0) redoStack.length = 0;
        emitChange();
      };

      const flushPending = () => {
        const tx = pending;
        pending = emptyTx();

        const parts: Command[] = [];

        if (tx.cellChanges.length > 0) {
          const merged = mergeCellChanges(tx.cellChanges);
          if (merged.length > 0) parts.push(makeCellsCommand(grid, merged));
        }

        if (tx.sortBefore !== null && tx.sortAfter !== null) {
          if (!sortEqual(tx.sortBefore, tx.sortAfter)) {
            parts.push(makeSortCommand(grid, tx.sortBefore, tx.sortAfter));
          }
        }

        for (const reorder of tx.reorders) {
          parts.push(makeReorderCommand(grid, reorder));
        }

        if (parts.length === 0) return;
        pushCommand(parts.length === 1 ? parts[0] : makeCompositeCommand(parts));
      };

      // ─── Listeners ────────────────────────────────────

      const unsubData = ctx.events.on('data:change', ({ changes }) => {
        if (isApplying || suppressDepth > 0) return;
        for (const c of changes) pending.cellChanges.push({ ...c });
        if (txDepth === 0) flushPending();
      });

      const unsubSort = ctx.events.on('sort:change', ({ sort }) => {
        const before = lastSort;
        lastSort = cloneSort(sort);
        if (isApplying || suppressDepth > 0) return;
        // First sort change in the transaction owns `before`; later changes
        // only update `after` so a single command captures the net delta.
        if (pending.sortBefore === null) pending.sortBefore = before;
        pending.sortAfter = cloneSort(sort);
        if (txDepth === 0) flushPending();
      });

      const unsubReorder = ctx.events.on('column:reorder', ({ columnId, fromIndex, toIndex }) => {
        if (isApplying || suppressDepth > 0) return;
        pending.reorders.push({ columnId, fromIndex, toIndex });
        if (txDepth === 0) flushPending();
      });

      const unsubTxBegin = ctx.events.on('transaction:begin', () => {
        txDepth++;
      });

      const unsubTxEnd = ctx.events.on('transaction:end', () => {
        if (txDepth > 0) txDepth--;
        if (txDepth === 0) flushPending();
      });

      // Wholesale data/column replacement invalidates every stored
      // dataIndex and reorder index — a stale undo would either throw from
      // `setCellByDataIndex` or apply to the wrong column. Drop both stacks
      // when the underlying schema changes from outside the history surface.
      const unsubRows = ctx.events.on('data:rowsUpdate', () => {
        if (isApplying || suppressDepth > 0) return;
        if (undoStack.length === 0 && redoStack.length === 0) return;
        undoStack.length = 0;
        redoStack.length = 0;
        emitChange();
      });
      const unsubCols = ctx.events.on('columns:update', ({ columns }) => {
        const nextIds = columnIdSet(columns);
        if (nextIds === lastColumnIds) return;
        lastColumnIds = nextIds;
        if (isApplying || suppressDepth > 0) return;
        if (undoStack.length === 0 && redoStack.length === 0) return;
        undoStack.length = 0;
        redoStack.length = 0;
        emitChange();
      });

      // ─── API ──────────────────────────────────────────

      const api: HistoryPluginApi = {
        undo() {
          const cmd = undoStack.pop();
          if (!cmd) return false;
          isApplying = true;
          try {
            cmd.undo();
          } finally {
            isApplying = false;
            // Keep our cached signal snapshots aligned with whatever the
            // command wrote back, since their listeners suppressed updates.
            lastSort = cloneSort(grid.sortState.peek());
          }
          redoStack.push(cmd);
          emitChange();
          return true;
        },

        redo() {
          const cmd = redoStack.pop();
          if (!cmd) return false;
          isApplying = true;
          try {
            cmd.redo();
          } finally {
            isApplying = false;
            lastSort = cloneSort(grid.sortState.peek());
          }
          undoStack.push(cmd);
          emitChange();
          return true;
        },

        canUndo() {
          return undoStack.length > 0;
        },

        canRedo() {
          return redoStack.length > 0;
        },

        batch(fn: () => void) {
          // Delegating to `grid.batchUpdate` reuses the transaction events
          // we already listen to, so explicit and implicit batches share the
          // same coalescing path.
          grid.batchUpdate(fn);
        },

        push(command: Command) {
          if (isApplying || suppressDepth > 0) return;
          pushCommand(command);
        },

        clear() {
          if (undoStack.length === 0 && redoStack.length === 0) return;
          undoStack.length = 0;
          redoStack.length = 0;
          emitChange();
        },

        getUndoSize() {
          return undoStack.length;
        },

        getRedoSize() {
          return redoStack.length;
        },

        setMaxSize(size: number) {
          maxSize = Math.max(1, Math.floor(size));
          while (undoStack.length > maxSize) undoStack.shift();
          emitChange();
        },

        suppress<T>(fn: () => T): T {
          suppressDepth++;
          try {
            return fn();
          } finally {
            suppressDepth--;
            // If suppression was nested inside an open transaction, the
            // `data:change` events we ignored won't be replayed — they never
            // entered `pending`. Discard any pending entries that a concurrent
            // listener happened to queue, so the next real edit starts clean.
            if (suppressDepth === 0 && txDepth === 0) {
              pending = emptyTx();
            }
          }
        },
      };

      ctx.expose('history', api);

      return () => {
        unsubData();
        unsubSort();
        unsubReorder();
        unsubTxBegin();
        unsubTxEnd();
        unsubRows();
        unsubCols();
        undoStack.length = 0;
        redoStack.length = 0;
      };
    },
  };

  return plugin;
}

export type { Command, HistoryPluginApi, HistoryPluginOptions };
