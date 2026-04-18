import { describe, expect, it, vi } from 'vitest';

import { createGrid } from './grid';
import { createSelectionPlugin } from './selection';
import type { ColumnDef, Row, SelectionPluginApi, SelectionState } from './types';

const columns: ColumnDef[] = [
  { id: 'a', header: 'A' },
  { id: 'b', header: 'B' },
  { id: 'c', header: 'C' },
  { id: 'd', header: 'D' },
];

const data: Row[] = [
  { a: 'a0', b: 'b0', c: 'c0', d: 'd0' },
  { a: 'a1', b: 'b1', c: 'c1', d: 'd1' },
  { a: 'a2', b: 'b2', c: 'c2', d: 'd2' },
  { a: 'a3', b: 'b3', c: 'c3', d: 'd3' },
];

function setup() {
  const plugin = createSelectionPlugin();
  const grid = createGrid({ data, columns, plugins: [plugin] });
  const api = grid.getPlugin<SelectionPluginApi>('selection')!;
  return { grid, api };
}

describe('selection plugin', () => {
  describe('initial state', () => {
    it('starts with no ranges and no active cell', () => {
      const { api } = setup();
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });
  });

  describe('selectCell', () => {
    it('replaces selection with a single cell range and sets active', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      expect(api.getState()).toEqual({
        ranges: [{ startRow: 1, endRow: 1, startCol: 'b', endCol: 'b' }],
        activeCell: { row: 1, col: 'b' },
      });
    });

    it('replaces an existing multi-cell selection', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.extendTo({ row: 2, col: 'c' });
      api.selectCell({ row: 3, col: 'd' });
      const state = api.getState();
      expect(state.ranges).toHaveLength(1);
      expect(state.ranges[0]).toEqual({
        startRow: 3,
        endRow: 3,
        startCol: 'd',
        endCol: 'd',
      });
      expect(state.activeCell).toEqual({ row: 3, col: 'd' });
    });
  });

  describe('extendTo', () => {
    it('grows the active range from the anchor to the new corner', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      api.extendTo({ row: 3, col: 'd' });
      expect(api.getState().ranges).toEqual([
        { startRow: 1, endRow: 3, startCol: 'b', endCol: 'd' },
      ]);
      expect(api.getState().activeCell).toEqual({ row: 3, col: 'd' });
    });

    it('normalizes when extending up and to the left', () => {
      const { api } = setup();
      api.selectCell({ row: 3, col: 'd' });
      api.extendTo({ row: 1, col: 'a' });
      expect(api.getState().ranges).toEqual([
        { startRow: 1, endRow: 3, startCol: 'a', endCol: 'd' },
      ]);
    });

    it('treats extendTo with no prior selection as selectCell', () => {
      const { api } = setup();
      api.extendTo({ row: 2, col: 'c' });
      expect(api.getState().ranges).toEqual([
        { startRow: 2, endRow: 2, startCol: 'c', endCol: 'c' },
      ]);
    });

    it('keeps the original anchor when extending again', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      api.extendTo({ row: 3, col: 'd' });
      api.extendTo({ row: 0, col: 'a' });
      expect(api.getState().ranges).toEqual([
        { startRow: 0, endRow: 1, startCol: 'a', endCol: 'b' },
      ]);
    });
  });

  describe('addCell', () => {
    it('adds a new range without removing the prior ones', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.addCell({ row: 2, col: 'c' });
      const state = api.getState();
      expect(state.ranges).toHaveLength(2);
      expect(state.ranges[0]).toEqual({
        startRow: 0,
        endRow: 0,
        startCol: 'a',
        endCol: 'a',
      });
      expect(state.ranges[1]).toEqual({
        startRow: 2,
        endRow: 2,
        startCol: 'c',
        endCol: 'c',
      });
      expect(state.activeCell).toEqual({ row: 2, col: 'c' });
    });

    it('moves extendTo to operate on the most recently added range', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.addCell({ row: 2, col: 'c' });
      api.extendTo({ row: 3, col: 'd' });
      const state = api.getState();
      expect(state.ranges[0]).toEqual({
        startRow: 0,
        endRow: 0,
        startCol: 'a',
        endCol: 'a',
      });
      expect(state.ranges[1]).toEqual({
        startRow: 2,
        endRow: 3,
        startCol: 'c',
        endCol: 'd',
      });
    });
  });

  describe('selectRow', () => {
    it('selects every column in the row', () => {
      const { api } = setup();
      api.selectRow(2);
      expect(api.getState().ranges).toEqual([
        { startRow: 2, endRow: 2, startCol: 'a', endCol: 'd' },
      ]);
    });

    it('extend mode grows from the anchor row', () => {
      const { api } = setup();
      api.selectRow(1);
      api.selectRow(3, 'extend');
      expect(api.getState().ranges).toEqual([
        { startRow: 1, endRow: 3, startCol: 'a', endCol: 'd' },
      ]);
    });

    it('add mode keeps prior ranges', () => {
      const { api } = setup();
      api.selectRow(0);
      api.selectRow(2, 'add');
      expect(api.getState().ranges).toHaveLength(2);
    });
  });

  describe('selectColumn', () => {
    it('selects every row of the column', () => {
      const { api } = setup();
      api.selectColumn('b');
      expect(api.getState().ranges).toEqual([
        { startRow: 0, endRow: 3, startCol: 'b', endCol: 'b' },
      ]);
    });

    it('extend mode grows from the anchor column to span both', () => {
      const { api } = setup();
      api.selectColumn('b');
      api.selectColumn('d', 'extend');
      const r = api.getState().ranges[0];
      expect(r.startRow).toBe(0);
      expect(r.endRow).toBe(3);
      // Must cover from anchor column 'b' through 'd'.
      expect(r.startCol).toBe('b');
      expect(r.endCol).toBe('d');
    });
  });

  describe('selectAll', () => {
    it('produces one range covering every cell', () => {
      const { api } = setup();
      api.selectAll();
      expect(api.getState().ranges).toEqual([
        { startRow: 0, endRow: 3, startCol: 'a', endCol: 'd' },
      ]);
      expect(api.getState().activeCell).toEqual({ row: 0, col: 'a' });
    });
  });

  describe('clear', () => {
    it('removes ranges and active cell', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      api.clear();
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });
  });

  describe('isCellSelected / isCellActive', () => {
    it('returns true for cells inside any range', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.extendTo({ row: 2, col: 'c' });
      expect(api.isCellSelected(1, 'b')).toBe(true);
      expect(api.isCellSelected(2, 'c')).toBe(true);
      expect(api.isCellSelected(3, 'd')).toBe(false);
    });

    it('returns true for cells inside any of multiple ranges', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.addCell({ row: 3, col: 'd' });
      expect(api.isCellSelected(0, 'a')).toBe(true);
      expect(api.isCellSelected(3, 'd')).toBe(true);
      expect(api.isCellSelected(1, 'b')).toBe(false);
    });

    it('isCellActive only matches the active cell', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      api.extendTo({ row: 3, col: 'd' });
      expect(api.isCellActive(3, 'd')).toBe(true);
      expect(api.isCellActive(1, 'b')).toBe(false);
      expect(api.isCellSelected(1, 'b')).toBe(true);
    });
  });

  describe('events', () => {
    it('emits selection:change with the new state', () => {
      const { grid, api } = setup();
      const handler = vi.fn();
      grid.subscribe('selection:change', handler);
      api.selectCell({ row: 1, col: 'b' });
      expect(handler).toHaveBeenCalledWith({
        ranges: [{ startRow: 1, endRow: 1, startCol: 'b', endCol: 'b' }],
        activeCell: { row: 1, col: 'b' },
      });
    });

    it('does not emit on clear when already empty', () => {
      const { grid, api } = setup();
      const handler = vi.fn();
      grid.subscribe('selection:change', handler);
      api.clear();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('cell decorator', () => {
    it('marks selected cells with gs-cell--selected', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.extendTo({ row: 1, col: 'b' });
      const decorations = grid.getCellDecorations(0, 'b');
      expect(decorations.some((d) => d.className?.includes('gs-cell--selected'))).toBe(true);
    });

    it('marks the active cell with gs-cell--active and gs-cell--focused', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      const decorations = grid.getCellDecorations(1, 'b');
      const className = decorations.map((d) => d.className).join(' ');
      expect(className).toContain('gs-cell--active');
      expect(className).toContain('gs-cell--focused');
    });

    it('returns nothing for cells outside the selection', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      expect(grid.getCellDecorations(3, 'd')).toEqual([]);
    });
  });

  describe('clears on data shape changes', () => {
    it('clears on sort change', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      grid.sortState.set([{ columnId: 'a', direction: 'asc' }]);
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('clears on filter change', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      grid.filterState.set([{ columnId: 'a', operator: 'contains', value: 'a' }]);
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('clears on data:rowsUpdate', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      grid.setData([{ a: 'x' }]);
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('clears on columns:update', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      grid.setColumns([{ id: 'a', header: 'A' }]);
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });
  });

  describe('cleanup', () => {
    it('clears selection on grid destroy', () => {
      const { grid, api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      grid.destroy();
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });
  });

  describe('edge cases', () => {
    it('selectAll on an empty grid produces no ranges and no active cell', () => {
      const plugin = createSelectionPlugin();
      const grid = createGrid({ data: [] as Row[], columns, plugins: [plugin] });
      const api = grid.getPlugin<SelectionPluginApi>('selection')!;
      api.selectAll();
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('selectRow on an empty-columns grid is a no-op', () => {
      const plugin = createSelectionPlugin();
      const grid = createGrid({ data, columns: [], plugins: [plugin] });
      const api = grid.getPlugin<SelectionPluginApi>('selection')!;
      api.selectRow(0);
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('selectColumn on an empty grid is a no-op', () => {
      const plugin = createSelectionPlugin();
      const grid = createGrid({ data: [] as Row[], columns, plugins: [plugin] });
      const api = grid.getPlugin<SelectionPluginApi>('selection')!;
      api.selectColumn('a');
      expect(api.getState()).toEqual({ ranges: [], activeCell: null });
    });

    it('selectCell with an unknown column id stores the id as-is and reports it as active', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'does-not-exist' });
      expect(api.isCellActive(0, 'does-not-exist')).toBe(true);
      // Unknown ids are not resolvable to neighbors, so only the endpoint cell counts.
      expect(api.isCellSelected(0, 'a')).toBe(false);
    });

    it('extendTo with a stale column id keeps endpoints addressable but skips intermediates', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.extendTo({ row: 0, col: 'does-not-exist' });
      expect(api.isCellSelected(0, 'a')).toBe(true);
      expect(api.isCellSelected(0, 'does-not-exist')).toBe(true);
      expect(api.isCellSelected(0, 'b')).toBe(false);
    });
  });

  describe('public state shape', () => {
    it('returns ranges without internal anchor fields', () => {
      const { api } = setup();
      api.selectCell({ row: 0, col: 'a' });
      api.extendTo({ row: 1, col: 'b' });
      const range = api.getState().ranges[0];
      expect(Object.keys(range).sort()).toEqual(['endCol', 'endRow', 'startCol', 'startRow']);
    });

    it('returns a deeply-decoupled state snapshot', () => {
      const { api } = setup();
      api.selectCell({ row: 1, col: 'b' });
      const snapshot: SelectionState = api.getState();
      api.selectCell({ row: 2, col: 'c' });
      // Mutating the prior snapshot cannot affect plugin state.
      expect(snapshot.activeCell).toEqual({ row: 1, col: 'b' });
    });
  });
});
