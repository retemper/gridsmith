// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createFillHandlePlugin } from './fill-handle';
import { createGrid } from './grid';
import { createHistoryPlugin } from './history';
import { createSelectionPlugin } from './selection';
import type {
  CellRange,
  ColumnDef,
  FillHandlePluginApi,
  HistoryPluginApi,
  Row,
  SelectionPluginApi,
} from './types';

const columns: ColumnDef[] = [
  { id: 'a', header: 'A', type: 'text' },
  { id: 'b', header: 'B', type: 'number' },
  { id: 'c', header: 'C', type: 'text' },
  { id: 'd', header: 'D', type: 'date' },
];

function makeRows(n: number): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < n; i++) out.push({ a: null, b: null, c: null, d: null });
  return out;
}

interface Setup {
  grid: ReturnType<typeof createGrid>;
  selection: SelectionPluginApi;
  history: HistoryPluginApi;
  fill: FillHandlePluginApi;
}

function setup(overrides: { data?: Row[]; columns?: ColumnDef[] } = {}): Setup {
  const grid = createGrid({
    data: overrides.data ?? makeRows(12),
    columns: overrides.columns ?? columns,
    plugins: [createSelectionPlugin(), createHistoryPlugin(), createFillHandlePlugin()],
  });
  return {
    grid,
    selection: grid.getPlugin<SelectionPluginApi>('selection')!,
    history: grid.getPlugin<HistoryPluginApi>('history')!,
    fill: grid.getPlugin<FillHandlePluginApi>('fill-handle')!,
  };
}

function range(startRow: number, endRow: number, startCol: string, endCol: string): CellRange {
  return { startRow, endRow, startCol, endCol };
}

describe('fill-handle plugin', () => {
  describe('inferPattern', () => {
    it('detects arithmetic progressions over numbers', () => {
      const { fill } = setup();
      expect(fill.inferPattern([1, 2, 3]).kind).toBe('arithmetic');
      expect(fill.inferPattern([2, 4, 6, 8]).kind).toBe('arithmetic');
      expect(fill.inferPattern([10, 5, 0]).kind).toBe('arithmetic');
    });

    it('treats constant numeric sequences as copy, not arithmetic', () => {
      const { fill } = setup();
      expect(fill.inferPattern([7, 7, 7]).kind).toBe('copy');
    });

    it('recognizes day-of-week short names case-insensitively', () => {
      const { fill } = setup();
      expect(fill.inferPattern(['Mon', 'Tue', 'Wed']).kind).toBe('day-name-short');
      expect(fill.inferPattern(['mon', 'TUE', 'wed']).kind).toBe('day-name-short');
    });

    it('recognizes month-of-year long names', () => {
      const { fill } = setup();
      expect(fill.inferPattern(['January', 'February', 'March']).kind).toBe('month-name-long');
    });

    it('recognizes Date sequences with a constant day step', () => {
      const { fill } = setup();
      const start = new Date(2026, 0, 1);
      const next = new Date(2026, 0, 2);
      const third = new Date(2026, 0, 3);
      expect(fill.inferPattern([start, next, third]).kind).toBe('date-day');
    });

    it('detects prefix+number sequences', () => {
      const { fill } = setup();
      expect(fill.inferPattern(['Q1', 'Q2', 'Q3']).kind).toBe('prefix-number');
      expect(fill.inferPattern(['Item5', 'Item10', 'Item15']).kind).toBe('prefix-number');
    });

    it('honors registered custom lists', () => {
      const { fill } = setup();
      fill.registerCustomList(['North', 'East', 'South', 'West']);
      expect(fill.inferPattern(['North', 'East', 'South']).kind).toBe('custom-list');
    });

    it('falls back to copy when nothing matches', () => {
      const { fill } = setup();
      expect(fill.inferPattern(['foo', 'bar']).kind).toBe('copy');
      expect(fill.inferPattern([1, 'a']).kind).toBe('copy');
    });

    it('treats a single-cell seed that matches a built-in list as a list sequence', () => {
      const { fill } = setup();
      expect(fill.inferPattern(['Jan']).kind).toBe('month-name-short');
      expect(fill.inferPattern(['January']).kind).toBe('month-name-long');
    });

    it('treats a single-cell seed that matches a custom list as a custom-list sequence', () => {
      const { fill } = setup();
      fill.registerCustomList(['Red', 'Green', 'Blue']);
      expect(fill.inferPattern(['Green']).kind).toBe('custom-list');
    });

    it('falls back to copy for constant date sequences', () => {
      const { fill } = setup();
      const d = new Date(2026, 0, 1);
      expect(fill.inferPattern([d, d, d]).kind).toBe('copy');
    });
  });

  describe('generateValues', () => {
    it('extrapolates arithmetic forward and reverse', () => {
      const { fill } = setup();
      expect(fill.generateValues([1, 2, 3], 3, 'forward')).toEqual([4, 5, 6]);
      expect(fill.generateValues([1, 2, 3], 3, 'reverse')).toEqual([0, -1, -2]);
    });

    it('cycles copy seeds in both directions', () => {
      const { fill } = setup();
      expect(fill.generateValues(['a', 'b'], 4, 'forward')).toEqual(['a', 'b', 'a', 'b']);
      expect(fill.generateValues(['a', 'b'], 3, 'reverse')).toEqual(['b', 'a', 'b']);
    });

    it('wraps day-of-week cycles', () => {
      const { fill } = setup();
      // Fri, Sat, Sun, Mon, Tue, Wed, Thu, Fri
      expect(fill.generateValues(['Fri'], 4, 'forward')).toEqual(['Sat', 'Sun', 'Mon', 'Tue']);
    });

    it('wraps month names and preserves canonical casing', () => {
      const { fill } = setup();
      // Seeds "nov","dec" in any case round-trip through canonical list entries.
      expect(fill.generateValues(['nov', 'dec'], 3, 'forward')).toEqual(['Jan', 'Feb', 'Mar']);
    });

    it('extends prefix+number progressions', () => {
      const { fill } = setup();
      expect(fill.generateValues(['Q1', 'Q2'], 3, 'forward')).toEqual(['Q3', 'Q4', 'Q5']);
    });

    it('adds days when extending a Date seed', () => {
      const { fill } = setup();
      const d1 = new Date(2026, 0, 1);
      const d2 = new Date(2026, 0, 2);
      const out = fill.generateValues([d1, d2], 2, 'forward') as Date[];
      expect(out[0].getFullYear()).toBe(2026);
      expect(out[0].getMonth()).toBe(0);
      expect(out[0].getDate()).toBe(3);
      expect(out[1].getDate()).toBe(4);
    });
  });

  describe('fill', () => {
    it('extends a numeric series down a single column', () => {
      const { grid, fill } = setup();
      grid.setCell(0, 'b', 1);
      grid.setCell(1, 'b', 2);
      const ok = fill.fill({
        source: range(0, 1, 'b', 'b'),
        target: range(0, 4, 'b', 'b'),
      });
      expect(ok).toBe(true);
      expect(grid.getCell(2, 'b')).toBe(3);
      expect(grid.getCell(3, 'b')).toBe(4);
      expect(grid.getCell(4, 'b')).toBe(5);
    });

    it('extends upward from the top of the source', () => {
      const { grid, fill } = setup();
      grid.setCell(5, 'b', 10);
      grid.setCell(6, 'b', 12);
      fill.fill({
        source: range(5, 6, 'b', 'b'),
        target: range(3, 6, 'b', 'b'),
      });
      // step=2, base=10, reverse-1 row → 8, reverse-2 rows → 6
      expect(grid.getCell(4, 'b')).toBe(8);
      expect(grid.getCell(3, 'b')).toBe(6);
    });

    it('copies a single-cell seed when no pattern can be inferred', () => {
      const { grid, fill } = setup();
      grid.setCell(0, 'a', 'hello');
      fill.fill({
        source: range(0, 0, 'a', 'a'),
        target: range(0, 3, 'a', 'a'),
      });
      expect(grid.getCell(1, 'a')).toBe('hello');
      expect(grid.getCell(2, 'a')).toBe('hello');
      expect(grid.getCell(3, 'a')).toBe('hello');
    });

    it('fills horizontally to the right across a row', () => {
      const { grid, fill } = setup({
        columns: [
          { id: 'n1', header: '1', type: 'number' },
          { id: 'n2', header: '2', type: 'number' },
          { id: 'n3', header: '3', type: 'number' },
          { id: 'n4', header: '4', type: 'number' },
        ],
        data: [{ n1: 10, n2: 20, n3: null, n4: null }],
      });
      fill.fill({
        source: range(0, 0, 'n1', 'n2'),
        target: range(0, 0, 'n1', 'n4'),
      });
      expect(grid.getCell(0, 'n3')).toBe(30);
      expect(grid.getCell(0, 'n4')).toBe(40);
    });

    it('fills each column independently for a multi-column source', () => {
      const { grid, fill } = setup({
        columns: [
          { id: 'x', header: 'X', type: 'number' },
          { id: 'y', header: 'Y', type: 'number' },
        ],
        data: [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
          { x: null, y: null },
          { x: null, y: null },
        ],
      });
      fill.fill({
        source: range(0, 1, 'x', 'y'),
        target: range(0, 3, 'x', 'y'),
      });
      expect(grid.getCell(2, 'x')).toBe(3);
      expect(grid.getCell(3, 'x')).toBe(4);
      expect(grid.getCell(2, 'y')).toBe(30);
      expect(grid.getCell(3, 'y')).toBe(40);
    });

    it('rejects targets smaller than source', () => {
      const { grid, fill } = setup();
      grid.setCell(0, 'b', 1);
      grid.setCell(1, 'b', 2);
      const ok = fill.fill({
        source: range(0, 1, 'b', 'b'),
        target: range(0, 0, 'b', 'b'),
      });
      expect(ok).toBe(false);
    });

    it('rejects two-axis extensions (ambiguous)', () => {
      const { grid, fill } = setup();
      grid.setCell(0, 'b', 1);
      const ok = fill.fill({
        source: range(0, 0, 'b', 'b'),
        target: range(0, 2, 'b', 'c'),
      });
      expect(ok).toBe(false);
    });

    it('skips cells in non-editable columns', () => {
      const { grid, fill } = setup({
        columns: [
          { id: 'b', header: 'B', type: 'number' },
          { id: 'r', header: 'R', type: 'number', editable: false },
        ],
        data: [
          { b: 1, r: 99 },
          { b: 2, r: 99 },
          { b: null, r: 99 },
        ],
      });
      fill.fill({
        source: range(0, 1, 'b', 'r'),
        target: range(0, 2, 'b', 'r'),
      });
      expect(grid.getCell(2, 'b')).toBe(3);
      expect(grid.getCell(2, 'r')).toBe(99);
    });

    it('records one undoable entry for the whole fill', () => {
      const { grid, history, fill } = setup();
      grid.setCell(0, 'b', 1);
      grid.setCell(1, 'b', 2);
      const before = history.getUndoSize();
      fill.fill({
        source: range(0, 1, 'b', 'b'),
        target: range(0, 5, 'b', 'b'),
      });
      expect(history.getUndoSize()).toBe(before + 1);
      history.undo();
      expect(grid.getCell(2, 'b')).toBeNull();
      expect(grid.getCell(3, 'b')).toBeNull();
      // Seed cells untouched by the fill are preserved.
      expect(grid.getCell(0, 'b')).toBe(1);
      expect(grid.getCell(1, 'b')).toBe(2);
      history.redo();
      expect(grid.getCell(2, 'b')).toBe(3);
      expect(grid.getCell(5, 'b')).toBe(6);
    });

    it('registers custom lists used by inferPattern and generateValues', () => {
      const { grid, fill } = setup();
      fill.registerCustomList(['Red', 'Green', 'Blue']);
      grid.setCell(0, 'a', 'Red');
      grid.setCell(1, 'a', 'Green');
      fill.fill({
        source: range(0, 1, 'a', 'a'),
        target: range(0, 5, 'a', 'a'),
      });
      expect(grid.getCell(2, 'a')).toBe('Blue');
      expect(grid.getCell(3, 'a')).toBe('Red');
      expect(grid.getCell(4, 'a')).toBe('Green');
      expect(grid.getCell(5, 'a')).toBe('Blue');
    });

    it('exposes registered custom lists via getCustomLists', () => {
      const { fill } = setup();
      fill.registerCustomList(['Small', 'Medium', 'Large']);
      const lists = fill.getCustomLists();
      expect(lists).toHaveLength(1);
      expect(lists[0]).toEqual(['Small', 'Medium', 'Large']);
    });

    it('extrapolates day-of-week long names and month-name short series', () => {
      const { fill } = setup();
      const days = fill.generateValues(['Monday', 'Tuesday'], 3, 'forward');
      expect(days).toEqual(['Wednesday', 'Thursday', 'Friday']);
      const months = fill.generateValues(['Jan', 'Feb'], 2, 'forward');
      expect(months).toEqual(['Mar', 'Apr']);
    });

    it('fills columns to the left of the source when target extends leftward', () => {
      const { grid, fill } = setup();
      grid.setCell(0, 'b', 1);
      grid.setCell(0, 'c', 2);
      fill.fill({
        source: range(0, 0, 'b', 'c'),
        target: range(0, 0, 'a', 'c'),
      });
      expect(grid.getCell(0, 'a')).toBe(0);
    });
  });
});
