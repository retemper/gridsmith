// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createChangesPlugin } from './changes';
import { createGrid } from './grid';
import { createHistoryPlugin } from './history';
import type { ChangesPluginApi, ColumnDef, HistoryPluginApi, Row } from './types';

const baseColumns: ColumnDef[] = [
  { id: 'a', header: 'A', type: 'text' },
  { id: 'b', header: 'B', type: 'number' },
  { id: 'c', header: 'C', type: 'text' },
];

const baseData: Row[] = [
  { a: 'a0', b: 10, c: 'c0' },
  { a: 'a1', b: 20, c: 'c1' },
  { a: 'a2', b: 30, c: 'c2' },
];

function setup(opts: { withHistory?: boolean; data?: Row[]; columns?: ColumnDef[] } = {}) {
  const plugins = [createChangesPlugin()];
  if (opts.withHistory) plugins.push(createHistoryPlugin());
  const grid = createGrid({
    data: opts.data ?? baseData.map((r) => ({ ...r })),
    columns: opts.columns ?? baseColumns,
    plugins,
  });
  return {
    grid,
    changes: grid.getPlugin<ChangesPluginApi>('changes')!,
    history: grid.getPlugin<HistoryPluginApi>('history'),
  };
}

describe('changes plugin', () => {
  describe('tracking', () => {
    it('marks a cell dirty on setCell and records original value', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'edited');

      expect(changes.isDirty(0, 'a')).toBe(true);
      expect(changes.getDirty()).toEqual([
        { row: 0, col: 'a', oldValue: 'a0', newValue: 'edited' },
      ]);
    });

    it('tracks multiple cells independently', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'x');
      grid.setCell(1, 'b', 99);

      expect(changes.getDirty()).toHaveLength(2);
      expect(changes.isDirty(0, 'a')).toBe(true);
      expect(changes.isDirty(1, 'b')).toBe(true);
      expect(changes.isDirty(0, 'b')).toBe(false);
    });

    it('preserves the original value when a cell is edited multiple times', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'first');
      grid.setCell(0, 'a', 'second');
      grid.setCell(0, 'a', 'third');

      expect(changes.getDirty()).toEqual([{ row: 0, col: 'a', oldValue: 'a0', newValue: 'third' }]);
    });

    it('drops an entry when the cell is edited back to its original value', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'edited');
      expect(changes.isDirty(0, 'a')).toBe(true);

      grid.setCell(0, 'a', 'a0');
      expect(changes.isDirty(0, 'a')).toBe(false);
      expect(changes.getDirty()).toEqual([]);
    });

    it('treats Date values with the same epoch as equal when restoring', () => {
      const columns: ColumnDef[] = [{ id: 'd', header: 'D', type: 'date' }];
      const originalDate = new Date(2024, 0, 1);
      const { grid, changes } = setup({ data: [{ d: originalDate }], columns });

      grid.setCell(0, 'd', new Date(2024, 5, 1));
      expect(changes.isDirty(0, 'd')).toBe(true);

      // Semantically equal Date — different instance. Should drop the entry.
      grid.setCell(0, 'd', new Date(2024, 0, 1));
      expect(changes.isDirty(0, 'd')).toBe(false);
    });

    it('isDirty returns false for out-of-range view rows', () => {
      const { changes } = setup();
      expect(changes.isDirty(-1, 'a')).toBe(false);
      expect(changes.isDirty(999, 'a')).toBe(false);
    });

    it('getDirty returns entries by data-index so they survive filtering', () => {
      const { grid, changes } = setup();

      grid.setCell(2, 'a', 'edited');
      grid.filterState.set([{ columnId: 'a', operator: 'eq', value: 'a0' }]);

      // View row 2 is filtered out — isDirty can't resolve it.
      expect(changes.isDirty(2, 'a')).toBe(false);
      // But the record is still there, keyed by data-index.
      expect(changes.getDirty()).toEqual([
        { row: 2, col: 'a', oldValue: 'a2', newValue: 'edited' },
      ]);
    });
  });

  describe('commit', () => {
    it('clears dirty state', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'x');
      grid.setCell(1, 'b', 99);

      changes.commit();

      expect(changes.getDirty()).toEqual([]);
      expect(changes.isDirty(0, 'a')).toBe(false);
    });

    it('does not touch cell values', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'x');
      changes.commit();

      expect(grid.getCell(0, 'a')).toBe('x');
    });

    it('after commit, a new edit is tracked against the committed value', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'first');
      changes.commit();

      grid.setCell(0, 'a', 'second');
      expect(changes.getDirty()).toEqual([
        { row: 0, col: 'a', oldValue: 'first', newValue: 'second' },
      ]);
    });

    it('emits changes:commit with the committed snapshot and changes:update with empty dirty', () => {
      const { grid, changes } = setup();
      grid.setCell(0, 'a', 'x');

      const commitHandler = vi.fn();
      const updateHandler = vi.fn();
      grid.subscribe('changes:commit', commitHandler);
      grid.subscribe('changes:update', updateHandler);

      changes.commit();

      expect(commitHandler).toHaveBeenCalledWith({
        changes: [{ row: 0, col: 'a', oldValue: 'a0', newValue: 'x' }],
      });
      expect(updateHandler).toHaveBeenCalledWith({ dirty: [] });
    });

    it('emits an empty commit event when nothing is dirty', () => {
      const { grid, changes } = setup();
      const handler = vi.fn();
      grid.subscribe('changes:commit', handler);

      changes.commit();
      expect(handler).toHaveBeenCalledWith({ changes: [] });
    });
  });

  describe('revert', () => {
    it('restores original values for all dirty cells', () => {
      const { grid, changes } = setup();

      grid.setCell(0, 'a', 'x');
      grid.setCell(1, 'b', 99);

      changes.revert();

      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(1, 'b')).toBe(20);
      expect(changes.getDirty()).toEqual([]);
    });

    it('emits changes:revert with the pre-revert snapshot', () => {
      const { grid, changes } = setup();
      grid.setCell(0, 'a', 'x');

      const handler = vi.fn();
      grid.subscribe('changes:revert', handler);

      changes.revert();

      expect(handler).toHaveBeenCalledWith({
        changes: [{ row: 0, col: 'a', oldValue: 'a0', newValue: 'x' }],
      });
    });

    it('works on cells that are filtered out of the current view', () => {
      const { grid, changes } = setup();

      grid.setCell(2, 'a', 'edited');
      grid.filterState.set([{ columnId: 'a', operator: 'eq', value: 'a0' }]);

      changes.revert();

      grid.filterState.set([]);
      expect(grid.getCell(2, 'a')).toBe('a2');
      expect(changes.getDirty()).toEqual([]);
    });

    it('is undoable as a single step when history is present', () => {
      const { grid, changes, history } = setup({ withHistory: true });

      grid.setCell(0, 'a', 'x');
      grid.setCell(1, 'b', 99);
      const undoBefore = history!.getUndoSize();

      changes.revert();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(1, 'b')).toBe(20);

      // One additional undoable entry for the batched revert.
      expect(history!.getUndoSize()).toBe(undoBefore + 1);
      history!.undo();
      expect(grid.getCell(0, 'a')).toBe('x');
      expect(grid.getCell(1, 'b')).toBe(99);
    });

    it('emits an empty revert event when nothing is dirty', () => {
      const { grid, changes } = setup();
      const handler = vi.fn();
      grid.subscribe('changes:revert', handler);

      changes.revert();
      expect(handler).toHaveBeenCalledWith({ changes: [] });
    });
  });

  describe('events', () => {
    it('emits changes:update on every dirty-state mutation', () => {
      const { grid, changes } = setup();
      const handler = vi.fn();
      grid.subscribe('changes:update', handler);

      grid.setCell(0, 'a', 'x');
      grid.setCell(0, 'a', 'y');
      grid.setCell(0, 'a', 'a0'); // reverts to original → dropped

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls[0][0]).toEqual({
        dirty: [{ row: 0, col: 'a', oldValue: 'a0', newValue: 'x' }],
      });
      expect(handler.mock.calls[2][0]).toEqual({ dirty: [] });
      expect(changes.getDirty()).toEqual([]);
    });

    it('does not emit when a setCell is a no-op', () => {
      const { grid } = setup();
      const handler = vi.fn();
      grid.subscribe('changes:update', handler);

      grid.setCell(0, 'a', 'a0');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('decorator', () => {
    it('surfaces gs-cell--dirty on dirty cells only', () => {
      const { grid } = setup();

      grid.setCell(0, 'a', 'x');

      const dirty = grid.getCellDecorations(0, 'a');
      const clean = grid.getCellDecorations(0, 'b');
      expect(dirty.some((d) => d.className === 'gs-cell--dirty')).toBe(true);
      expect(clean.some((d) => d.className === 'gs-cell--dirty')).toBe(false);
    });
  });

  describe('schema invalidation', () => {
    it('clears dirty state when setData replaces rows wholesale', () => {
      const { grid, changes } = setup();
      grid.setCell(0, 'a', 'x');
      expect(changes.getDirty()).toHaveLength(1);

      grid.setData([{ a: 'fresh', b: 1, c: 'c' }]);
      expect(changes.getDirty()).toEqual([]);
    });

    it('drops entries for columns removed via setColumns', () => {
      const { grid, changes } = setup();
      grid.setCell(0, 'a', 'x');
      grid.setCell(0, 'b', 99);

      grid.setColumns([
        { id: 'a', header: 'A', type: 'text' },
        { id: 'c', header: 'C', type: 'text' },
      ]);

      const remaining = changes.getDirty();
      expect(remaining).toEqual([{ row: 0, col: 'a', oldValue: 'a0', newValue: 'x' }]);
    });

    it('keeps entries intact across a pure column reorder', () => {
      const { grid, changes } = setup();
      grid.setCell(0, 'a', 'x');

      grid.reorderColumn(0, 2);

      expect(changes.getDirty()).toEqual([{ row: 0, col: 'a', oldValue: 'a0', newValue: 'x' }]);
    });
  });
});
