// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createClipboardPlugin } from './clipboard';
import { createGrid } from './grid';
import { createHistoryPlugin } from './history';
import { createSelectionPlugin } from './selection';
import type {
  ClipboardPluginApi,
  ColumnDef,
  HistoryPluginApi,
  HistoryPluginOptions,
  Row,
  SelectionPluginApi,
} from './types';

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

function setup(opts: { history?: HistoryPluginOptions; data?: Row[]; columns?: ColumnDef[] } = {}) {
  const grid = createGrid({
    data: opts.data ?? baseData,
    columns: opts.columns ?? baseColumns,
    plugins: [createSelectionPlugin(), createClipboardPlugin(), createHistoryPlugin(opts.history)],
  });
  return {
    grid,
    history: grid.getPlugin<HistoryPluginApi>('history')!,
    selection: grid.getPlugin<SelectionPluginApi>('selection')!,
    clipboard: grid.getPlugin<ClipboardPluginApi>('clipboard')!,
  };
}

describe('history plugin', () => {
  describe('cell edits', () => {
    it('records and undoes a single setCell', () => {
      const { grid, history } = setup();

      grid.setCell(0, 'a', 'changed');
      expect(grid.getCell(0, 'a')).toBe('changed');
      expect(history.canUndo()).toBe(true);

      expect(history.undo()).toBe(true);
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    it('redoes after undo', () => {
      const { grid, history } = setup();

      grid.setCell(0, 'a', 'changed');
      history.undo();
      expect(history.redo()).toBe(true);
      expect(grid.getCell(0, 'a')).toBe('changed');
      expect(history.canRedo()).toBe(false);
    });

    it('records each setCell as its own command outside a batch', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      grid.setCell(1, 'a', 'y');

      expect(history.getUndoSize()).toBe(2);

      history.undo();
      expect(grid.getCell(1, 'a')).toBe('a1');
      expect(grid.getCell(0, 'a')).toBe('x');

      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
    });

    it('clears redo stack when a new mutation lands', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      history.undo();
      expect(history.canRedo()).toBe(true);

      grid.setCell(0, 'b', 99);
      expect(history.canRedo()).toBe(false);
    });

    it('does not record when newValue equals oldValue (no event)', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'a0');
      expect(history.getUndoSize()).toBe(0);
    });
  });

  describe('batch / transactions', () => {
    it('coalesces multiple setCells inside grid.batchUpdate into one entry', () => {
      const { grid, history } = setup();

      grid.batchUpdate(() => {
        grid.setCell(0, 'a', 'x');
        grid.setCell(1, 'a', 'y');
        grid.setCell(2, 'a', 'z');
      });

      expect(history.getUndoSize()).toBe(1);

      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(1, 'a')).toBe('a1');
      expect(grid.getCell(2, 'a')).toBe('a2');
    });

    it('history.batch wraps mutations into a single undoable step', () => {
      const { grid, history } = setup();

      history.batch(() => {
        grid.setCell(0, 'a', 'x');
        grid.setCell(0, 'b', 99);
      });

      expect(history.getUndoSize()).toBe(1);
      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(0, 'b')).toBe(10);
    });

    it('collapses repeated touches on the same cell, preserving the original oldValue', () => {
      const { grid, history } = setup();

      grid.batchUpdate(() => {
        grid.setCell(0, 'a', 'first');
        grid.setCell(0, 'a', 'second');
        grid.setCell(0, 'a', 'third');
      });

      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');

      history.redo();
      expect(grid.getCell(0, 'a')).toBe('third');
    });

    it('flattens nested batches into a single command', () => {
      const { grid, history } = setup();

      grid.batchUpdate(() => {
        grid.setCell(0, 'a', 'x');
        grid.batchUpdate(() => {
          grid.setCell(1, 'a', 'y');
        });
        grid.setCell(2, 'a', 'z');
      });

      expect(history.getUndoSize()).toBe(1);
      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(1, 'a')).toBe('a1');
      expect(grid.getCell(2, 'a')).toBe('a2');
    });

    it('does not push a command when a batch makes no observable change', () => {
      const { grid, history } = setup();
      grid.batchUpdate(() => {
        grid.setCell(0, 'a', 'a0');
      });
      expect(history.getUndoSize()).toBe(0);
    });
  });

  describe('clipboard integration', () => {
    it('paste via applyMatrix is undoable as one step', () => {
      const { grid, history, clipboard } = setup();

      clipboard.applyMatrix(
        [
          ['x', '99'],
          ['y', '88'],
        ],
        0,
        'a',
      );

      expect(grid.getCell(0, 'a')).toBe('x');
      expect(grid.getCell(0, 'b')).toBe(99);
      expect(grid.getCell(1, 'a')).toBe('y');
      expect(grid.getCell(1, 'b')).toBe(88);
      expect(history.getUndoSize()).toBe(1);

      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(0, 'b')).toBe(10);
      expect(grid.getCell(1, 'a')).toBe('a1');
      expect(grid.getCell(1, 'b')).toBe(20);
    });

    it('deleteSelection is undoable as one step and restores original values', () => {
      const { grid, history, selection, clipboard } = setup();

      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 1, col: 'b' });
      clipboard.deleteSelection();

      expect(grid.getCell(0, 'a')).toBeNull();
      expect(grid.getCell(1, 'b')).toBeNull();
      expect(history.getUndoSize()).toBe(1);

      history.undo();
      expect(grid.getCell(0, 'a')).toBe('a0');
      expect(grid.getCell(0, 'b')).toBe(10);
      expect(grid.getCell(1, 'a')).toBe('a1');
      expect(grid.getCell(1, 'b')).toBe(20);
    });
  });

  describe('sort', () => {
    it('records and reverses a sort change', () => {
      const { grid, history } = setup();

      grid.sortState.set([{ columnId: 'a', direction: 'desc' }]);
      expect(history.getUndoSize()).toBe(1);

      history.undo();
      expect(grid.sortState.peek()).toEqual([]);

      history.redo();
      expect(grid.sortState.peek()).toEqual([{ columnId: 'a', direction: 'desc' }]);
    });
  });

  describe('column reorder', () => {
    it('records and reverses a column reorder', () => {
      const { grid, history } = setup();

      // Move 'a' (index 0) to position 2
      grid.reorderColumn(0, 2);
      expect(grid.columns.get().map((c) => c.id)).toEqual(['b', 'c', 'a']);

      history.undo();
      expect(grid.columns.get().map((c) => c.id)).toEqual(['a', 'b', 'c']);

      history.redo();
      expect(grid.columns.get().map((c) => c.id)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('stack size', () => {
    it('caps the undo stack at maxSize, dropping the oldest entries', () => {
      const { grid, history } = setup({ history: { maxSize: 3 } });

      grid.setCell(0, 'a', '1');
      grid.setCell(0, 'a', '2');
      grid.setCell(0, 'a', '3');
      grid.setCell(0, 'a', '4');

      expect(history.getUndoSize()).toBe(3);

      // Drain — value should not roll back past the dropped first edit.
      history.undo();
      history.undo();
      history.undo();
      expect(history.canUndo()).toBe(false);
      expect(grid.getCell(0, 'a')).toBe('1');
    });

    it('default maxSize is 100', () => {
      const { grid, history } = setup();
      for (let i = 0; i < 150; i++) {
        grid.setCell(0, 'a', `v${i}`);
      }
      expect(history.getUndoSize()).toBe(100);
    });

    it('setMaxSize trims to the new limit immediately', () => {
      const { grid, history } = setup();
      for (let i = 0; i < 5; i++) grid.setCell(0, 'a', `v${i}`);
      expect(history.getUndoSize()).toBe(5);

      history.setMaxSize(2);
      expect(history.getUndoSize()).toBe(2);
    });
  });

  describe('clear', () => {
    it('empties both stacks and emits history:change', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      history.undo();

      const handler = vi.fn();
      grid.subscribe('history:change', handler);

      history.clear();
      expect(history.getUndoSize()).toBe(0);
      expect(history.getRedoSize()).toBe(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('events', () => {
    it('emits history:change on push, undo, redo, and clear', () => {
      const { grid, history } = setup();
      const handler = vi.fn();
      grid.subscribe('history:change', handler);

      grid.setCell(0, 'a', 'x');
      expect(handler).toHaveBeenLastCalledWith({
        canUndo: true,
        canRedo: false,
        undoSize: 1,
        redoSize: 0,
      });

      history.undo();
      expect(handler).toHaveBeenLastCalledWith({
        canUndo: false,
        canRedo: true,
        undoSize: 0,
        redoSize: 1,
      });

      history.redo();
      expect(handler).toHaveBeenLastCalledWith({
        canUndo: true,
        canRedo: false,
        undoSize: 1,
        redoSize: 0,
      });
    });
  });

  describe('schema invalidation', () => {
    it('clears history when setData replaces rows wholesale', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      expect(history.canUndo()).toBe(true);

      grid.setData([{ a: 'fresh', b: 1, c: 'c' }]);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    it('clears history when setColumns changes the leaf list', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      expect(history.canUndo()).toBe(true);

      grid.setColumns([
        { id: 'a', header: 'A', type: 'text' },
        { id: 'b', header: 'B', type: 'number' },
      ]);
      expect(history.canUndo()).toBe(false);
    });
  });

  describe('safety', () => {
    it('undo on empty stack returns false and is a no-op', () => {
      const { history } = setup();
      expect(history.undo()).toBe(false);
    });

    it('redo on empty stack returns false and is a no-op', () => {
      const { history } = setup();
      expect(history.redo()).toBe(false);
    });

    it('does not push mirror entries while applying an undo', () => {
      const { grid, history } = setup();
      grid.setCell(0, 'a', 'x');
      history.undo();
      expect(history.getUndoSize()).toBe(0);
      expect(history.getRedoSize()).toBe(1);
    });
  });
});
