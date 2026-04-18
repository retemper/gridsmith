// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClipboardPlugin } from './clipboard';
import { createGrid } from './grid';
import { createSelectionPlugin } from './selection';
import type { CellRange, ClipboardPluginApi, ColumnDef, Row, SelectionPluginApi } from './types';

const columns: ColumnDef[] = [
  { id: 'a', header: 'A', type: 'text' },
  { id: 'b', header: 'B', type: 'number' },
  { id: 'c', header: 'C', type: 'checkbox' },
  { id: 'd', header: 'D', type: 'text' },
];

const initialData: Row[] = [
  { a: 'a0', b: 10, c: true, d: 'd0' },
  { a: 'a1', b: 20, c: false, d: 'd1' },
  { a: 'a2', b: 30, c: true, d: 'd2' },
  { a: 'a3', b: 40, c: false, d: 'd3' },
];

function setup(overrides: { data?: Row[]; columns?: ColumnDef[] } = {}): {
  grid: ReturnType<typeof createGrid>;
  selection: SelectionPluginApi;
  clipboard: ClipboardPluginApi;
} {
  const grid = createGrid({
    data: overrides.data ?? initialData,
    columns: overrides.columns ?? columns,
    plugins: [createSelectionPlugin(), createClipboardPlugin()],
  });
  return {
    grid,
    selection: grid.getPlugin<SelectionPluginApi>('selection')!,
    clipboard: grid.getPlugin<ClipboardPluginApi>('clipboard')!,
  };
}

function range(startRow: number, endRow: number, startCol: string, endCol: string): CellRange {
  return { startRow, endRow, startCol, endCol };
}

describe('clipboard plugin', () => {
  describe('serializeRange', () => {
    it('emits TSV matching Excel output for a simple range', () => {
      const { clipboard } = setup();
      const payload = clipboard.serializeRange(range(0, 1, 'a', 'b'));
      expect(payload.text).toBe('a0\t10\na1\t20');
    });

    it('emits HTML with one <tr> per row and one <td> per cell', () => {
      const { clipboard } = setup();
      const { html } = clipboard.serializeRange(range(0, 1, 'a', 'b'));
      expect(html).toContain('<table>');
      expect(html).toContain('<tr><td>a0</td><td>10</td></tr>');
      expect(html).toContain('<tr><td>a1</td><td>20</td></tr>');
    });

    it('formats booleans as TRUE/FALSE to match Excel', () => {
      const { clipboard } = setup();
      const { text } = clipboard.serializeRange(range(0, 1, 'c', 'c'));
      expect(text).toBe('TRUE\nFALSE');
    });

    it('formats dates as YYYY-MM-DD', () => {
      const { clipboard } = setup({
        data: [{ a: new Date(2026, 0, 5) }],
        columns: [{ id: 'a', header: 'A', type: 'date' }],
      });
      const { text } = clipboard.serializeRange(range(0, 0, 'a', 'a'));
      expect(text).toBe('2026-01-05');
    });

    it('quotes cells containing tabs, newlines, or double-quotes', () => {
      const { clipboard } = setup({
        data: [
          { a: 'has\ttab', b: 'line1\nline2' },
          { a: 'quote"inside', b: 'plain' },
        ],
        columns: [
          { id: 'a', header: 'A', type: 'text' },
          { id: 'b', header: 'B', type: 'text' },
        ],
      });
      const { text } = clipboard.serializeRange(range(0, 1, 'a', 'b'));
      expect(text).toContain('"has\ttab"');
      expect(text).toContain('"line1\nline2"');
      expect(text).toContain('"quote""inside"');
      expect(text).toContain('plain');
    });

    it('renders null/undefined as empty string', () => {
      const { clipboard } = setup({
        data: [{ a: null, b: undefined }],
        columns: [
          { id: 'a', header: 'A', type: 'text' },
          { id: 'b', header: 'B', type: 'text' },
        ],
      });
      const { text } = clipboard.serializeRange(range(0, 0, 'a', 'b'));
      expect(text).toBe('\t');
    });
  });

  describe('parsePayload', () => {
    it('parses plain TSV into a string matrix', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({ text: 'x\ty\nz\tw' });
      expect(parsed).toEqual([
        ['x', 'y'],
        ['z', 'w'],
      ]);
    });

    it('drops a trailing empty row (Excel appends CRLF)', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({ text: 'x\ty\r\n' });
      expect(parsed).toEqual([['x', 'y']]);
    });

    it('parses quoted cells with embedded tabs, newlines, and doubled quotes', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({
        text: '"a\tb"\t"line1\nline2"\n"he said ""hi"""\tplain',
      });
      expect(parsed).toEqual([
        ['a\tb', 'line1\nline2'],
        ['he said "hi"', 'plain'],
      ]);
    });

    it('prefers HTML table when present', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({
        text: 'ignored',
        html: '<table><tr><td>html1</td><td>html2</td></tr></table>',
      });
      expect(parsed).toEqual([['html1', 'html2']]);
    });

    it('falls back to TSV when HTML has no table', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({
        text: 'a\tb',
        html: '<div>not a table</div>',
      });
      expect(parsed).toEqual([['a', 'b']]);
    });

    it('falls back to TSV when HTML table has no rows', () => {
      const { clipboard } = setup();
      const parsed = clipboard.parsePayload({
        text: 'a\tb',
        html: '<table></table>',
      });
      expect(parsed).toEqual([['a', 'b']]);
    });

    it('returns null for empty input', () => {
      const { clipboard } = setup();
      expect(clipboard.parsePayload({})).toBeNull();
      expect(clipboard.parsePayload({ text: '' })).toBeNull();
    });
  });

  describe('applyMatrix', () => {
    it('writes values starting at (row, col) and stops at the right edge', () => {
      const { clipboard, grid } = setup();
      clipboard.applyMatrix(
        [
          ['x', 'y'],
          ['z', 'w'],
        ],
        1,
        'c',
      );
      expect(grid.getCell(1, 'c')).toBe('x'); // text coerce for type='checkbox' -> string fallback
      expect(grid.getCell(1, 'd')).toBe('y');
      expect(grid.getCell(2, 'c')).toBe('z');
      expect(grid.getCell(2, 'd')).toBe('w');
    });

    it('coerces strings to the target column type on paste', () => {
      const { clipboard, grid } = setup();
      clipboard.applyMatrix([['42', 'TRUE']], 0, 'b');
      expect(grid.getCell(0, 'b')).toBe(42);
      expect(grid.getCell(0, 'c')).toBe(true);
    });

    it('parses dates back to Date objects in date columns', () => {
      const { clipboard, grid } = setup({
        data: [{ a: null }],
        columns: [{ id: 'a', header: 'A', type: 'date' }],
      });
      clipboard.applyMatrix([['2026-04-18']], 0, 'a');
      const value = grid.getCell(0, 'a');
      expect(value).toBeInstanceOf(Date);
      expect((value as Date).getFullYear()).toBe(2026);
    });

    it('treats empty string as null', () => {
      const { clipboard, grid } = setup();
      clipboard.applyMatrix([['']], 0, 'a');
      expect(grid.getCell(0, 'a')).toBeNull();
    });

    it('skips cells that fall outside the grid bounds', () => {
      const { clipboard, grid } = setup();
      clipboard.applyMatrix([['keep', 'skip']], 3, 'd');
      expect(grid.getCell(3, 'd')).toBe('keep');
      // No row 4, so second cell has nowhere to land — grid only has rows 0..3.
      expect(grid.rowCount).toBe(4);
    });

    it('skips non-editable columns', () => {
      const { clipboard, grid } = setup({
        columns: [
          { id: 'a', header: 'A', type: 'text' },
          { id: 'b', header: 'B', type: 'text', editable: false },
        ],
        data: [{ a: 'old-a', b: 'old-b' }],
      });
      clipboard.applyMatrix([['new-a', 'new-b']], 0, 'a');
      expect(grid.getCell(0, 'a')).toBe('new-a');
      expect(grid.getCell(0, 'b')).toBe('old-b');
    });
  });

  describe('deleteSelection', () => {
    it('clears every selected cell', () => {
      const { clipboard, selection, grid } = setup();
      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 1, col: 'b' });
      expect(clipboard.deleteSelection()).toBe(true);
      expect(grid.getCell(0, 'a')).toBeNull();
      expect(grid.getCell(0, 'b')).toBeNull();
      expect(grid.getCell(1, 'a')).toBeNull();
      expect(grid.getCell(1, 'b')).toBeNull();
      // Untouched.
      expect(grid.getCell(2, 'a')).toBe('a2');
    });

    it('returns false when the selection is empty', () => {
      const { clipboard } = setup();
      expect(clipboard.deleteSelection()).toBe(false);
    });

    it('handles multi-range selections', () => {
      const { clipboard, selection, grid } = setup();
      selection.selectCell({ row: 0, col: 'a' });
      selection.addCell({ row: 3, col: 'd' });
      expect(clipboard.deleteSelection()).toBe(true);
      expect(grid.getCell(0, 'a')).toBeNull();
      expect(grid.getCell(3, 'd')).toBeNull();
      expect(grid.getCell(1, 'a')).toBe('a1');
    });

    it('returns true even when every selected cell is already null', () => {
      const { clipboard, selection } = setup({
        data: [{ a: null, b: null }],
        columns: [
          { id: 'a', header: 'A', type: 'text' },
          { id: 'b', header: 'B', type: 'text' },
        ],
      });
      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 0, col: 'b' });
      // Contract: "was a selection handled?", not "did any cell change value?"
      expect(clipboard.deleteSelection()).toBe(true);
    });

    it('leaves non-editable cells untouched', () => {
      const { clipboard, selection, grid } = setup({
        columns: [
          { id: 'a', header: 'A', type: 'text' },
          { id: 'b', header: 'B', type: 'text', editable: false },
        ],
        data: [{ a: 'old-a', b: 'old-b' }],
      });
      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 0, col: 'b' });
      clipboard.deleteSelection();
      expect(grid.getCell(0, 'a')).toBeNull();
      expect(grid.getCell(0, 'b')).toBe('old-b');
    });
  });

  // ─── Navigator.clipboard integration ────────────────────────

  describe('copy / cut / paste (with mocked Clipboard API)', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator),
      'clipboard',
    );
    let writeText: ReturnType<typeof vi.fn>;
    let readText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      readText = vi.fn().mockResolvedValue('');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText, readText },
      });
    });

    afterEach(() => {
      if (originalClipboard) {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'clipboard', originalClipboard);
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
    });

    it('copy writes TSV to the clipboard and emits clipboard:copy', async () => {
      const { clipboard, selection, grid } = setup();
      const handler = vi.fn();
      grid.subscribe('clipboard:copy', handler);
      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 1, col: 'b' });
      const ok = await clipboard.copy();
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith('a0\t10\na1\t20');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ rows: 2, cols: 2 }));
    });

    it('copy returns false when the selection is empty', async () => {
      const { clipboard } = setup();
      const ok = await clipboard.copy();
      expect(ok).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
    });

    it('copy succeeds for a single empty cell and writes an empty TSV', async () => {
      const grid = createGrid({
        data: [{ a: null }],
        columns: [{ id: 'a', header: 'A', type: 'text' }],
        plugins: [createSelectionPlugin(), createClipboardPlugin()],
      });
      const selection = grid.getPlugin<SelectionPluginApi>('selection')!;
      const clipboard = grid.getPlugin<ClipboardPluginApi>('clipboard')!;
      selection.selectCell({ row: 0, col: 'a' });
      const ok = await clipboard.copy();
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith('');
    });

    it('cut copies then clears the source range', async () => {
      const { clipboard, selection, grid } = setup();
      selection.selectCell({ row: 0, col: 'a' });
      selection.extendTo({ row: 0, col: 'b' });
      const ok = await clipboard.cut();
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith('a0\t10');
      expect(grid.getCell(0, 'a')).toBeNull();
      expect(grid.getCell(0, 'b')).toBeNull();
    });

    it('paste reads TSV and applies it at the active cell', async () => {
      const { clipboard, selection, grid } = setup();
      selection.selectCell({ row: 2, col: 'a' });
      readText.mockResolvedValue('X\t99\nZ\t100');
      const ok = await clipboard.paste();
      expect(ok).toBe(true);
      expect(grid.getCell(2, 'a')).toBe('X');
      expect(grid.getCell(2, 'b')).toBe(99);
      expect(grid.getCell(3, 'a')).toBe('Z');
      expect(grid.getCell(3, 'b')).toBe(100);
    });

    it('paste keeps non-numeric strings as raw text when the column type cannot coerce them', async () => {
      const { clipboard, selection, grid } = setup();
      selection.selectCell({ row: 2, col: 'b' });
      readText.mockResolvedValue('not-a-number');
      const ok = await clipboard.paste();
      expect(ok).toBe(true);
      expect(grid.getCell(2, 'b')).toBe('not-a-number');
    });

    it('paste is a no-op when there is no active cell', async () => {
      const { clipboard } = setup();
      readText.mockResolvedValue('a\tb');
      const ok = await clipboard.paste();
      expect(ok).toBe(false);
    });

    it('copy returns false when the Clipboard API rejects', async () => {
      writeText.mockRejectedValueOnce(new Error('permission denied'));
      const { clipboard, selection } = setup();
      selection.selectCell({ row: 0, col: 'a' });
      const ok = await clipboard.copy();
      expect(ok).toBe(false);
    });
  });

  describe('copy / paste without a Clipboard API', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator),
      'clipboard',
    );

    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      });
    });

    afterEach(() => {
      if (originalClipboard) {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'clipboard', originalClipboard);
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
    });

    it('returns false when the clipboard is unavailable', async () => {
      const { clipboard, selection } = setup();
      selection.selectCell({ row: 0, col: 'a' });
      expect(await clipboard.copy()).toBe(false);
      expect(await clipboard.cut()).toBe(false);
      expect(await clipboard.paste()).toBe(false);
    });
  });

  describe('range invariants', () => {
    it('serializes correctly when the range is created in reverse order', () => {
      const { clipboard } = setup();
      // startCol 'b' > endCol 'a' by column index, but range must still cover both.
      const payload = clipboard.serializeRange({
        startRow: 1,
        endRow: 0,
        startCol: 'b',
        endCol: 'a',
      });
      expect(payload.text).toBe('a0\t10\na1\t20');
    });
  });
});
