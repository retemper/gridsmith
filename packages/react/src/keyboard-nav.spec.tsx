import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { Grid } from './grid';
import type { GridColumnDef } from './types';

// ─── DOM mocks ────────────────────────────────────────────
//
// jsdom reports clientWidth/clientHeight as 0 by default. The Grid needs a
// non-zero viewport to compute visible ranges and page sizes. These mocks
// match the scheme used in the sibling spec files.

const origCW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const origCH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 500;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 300;
    },
  });

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  if (origCW) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origCW);
  if (origCH) Object.defineProperty(HTMLElement.prototype, 'clientHeight', origCH);
  vi.restoreAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────

const columns: GridColumnDef[] = [
  { id: 'a', header: 'A', type: 'text' },
  { id: 'b', header: 'B', type: 'text' },
  { id: 'c', header: 'C', type: 'text' },
];

const data = [
  { a: 'a0', b: 'b0', c: 'c0' },
  { a: 'a1', b: 'b1', c: 'c1' },
  { a: 'a2', b: 'b2', c: 'c2' },
];

function findCell(row: number, col: string): HTMLElement {
  const el = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!el) throw new Error(`cell (${row}, ${col}) not found`);
  return el as HTMLElement;
}

function getGridRoot(): HTMLElement {
  const root = document.querySelector('.gs-grid');
  if (!root) throw new Error('Grid root not found');
  return root as HTMLElement;
}

function focusedCellPos(): { row: string | null; col: string | null } {
  const el = document.querySelector('.gs-cell--focused') as HTMLElement | null;
  return {
    row: el?.dataset.row ?? null,
    col: el?.dataset.col ?? null,
  };
}

// ─── Tests ────────────────────────────────────────────────

describe('keyboard navigation — arrow keys', () => {
  it('applies gs-cell--focused class on click', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'b'));
    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });

  it('ArrowDown moves focus down one row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowDown' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('ArrowDown is clamped at the last row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(2, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowDown' });
    expect(focusedCellPos()).toEqual({ row: '2', col: 'a' });
  });

  it('ArrowUp moves focus up one row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(2, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowUp' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });

  it('ArrowUp is clamped at row 0', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowUp' });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'a' });
  });

  it('ArrowRight moves focus to next column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowRight' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });

  it('ArrowRight does not move past the last column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowRight' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'c' });
  });

  it('ArrowLeft moves focus to previous column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowLeft' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });

  it('ArrowLeft does not move past the first column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowLeft' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('ArrowRight skips hidden columns', () => {
    const cols: GridColumnDef[] = [
      { id: 'a', header: 'A' },
      { id: 'b', header: 'B', visible: false },
      { id: 'c', header: 'C' },
    ];
    const rows = [{ a: '0', b: '1', c: '2' }];
    render(<Grid data={rows} columns={cols} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowRight' });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'c' });
  });
});

describe('keyboard navigation — Ctrl jumps', () => {
  it('Ctrl+ArrowDown jumps to the last row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowDown', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '2', col: 'b' });
  });

  it('Ctrl+ArrowUp jumps to the first row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(2, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowUp', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'b' });
  });

  it('Ctrl+ArrowRight jumps to the last column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowRight', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'c' });
  });

  it('Ctrl+ArrowLeft jumps to the first column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowLeft', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('metaKey (Cmd on macOS) works like Ctrl', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowDown', metaKey: true });
    expect(focusedCellPos()).toEqual({ row: '2', col: 'b' });
  });
});

describe('keyboard navigation — Home/End/PageUp/PageDown', () => {
  it('Home moves to first column of current row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'Home' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('End moves to last column of current row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'End' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'c' });
  });

  it('Ctrl+Home moves to the first cell (0,0)', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(2, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'Home', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'a' });
  });

  it('Ctrl+End moves to the last cell', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'End', ctrlKey: true });
    expect(focusedCellPos()).toEqual({ row: '2', col: 'c' });
  });

  it('PageDown jumps by viewport-sized row chunks', () => {
    // 20 rows × default rowHeight 32 = 640px; viewport clientHeight mocked to
    // 300 → page size = floor(300/32) = 9.
    const many = Array.from({ length: 20 }, (_, i) => ({
      a: `a${i}`,
      b: `b${i}`,
      c: `c${i}`,
    }));
    render(<Grid data={many} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'PageDown' });
    expect(focusedCellPos().row).toBe('9');
  });

  it('PageUp jumps backwards by viewport-sized chunks and clamps at 0', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      a: `a${i}`,
      b: `b${i}`,
      c: `c${i}`,
    }));
    render(<Grid data={many} columns={columns} />);
    fireEvent.click(findCell(5, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'PageUp' });
    expect(focusedCellPos().row).toBe('0');
  });
});

describe('keyboard navigation — Tab/Shift+Tab in nav mode', () => {
  it('Tab moves focus right in nav mode', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'Tab' });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'b' });
  });

  it('Tab wraps to next row at end of row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'c'));
    fireEvent.keyDown(getGridRoot(), { key: 'Tab' });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('Shift+Tab moves focus left and wraps to previous row at start', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'Tab', shiftKey: true });
    expect(focusedCellPos()).toEqual({ row: '0', col: 'c' });
  });

  it('Shift+Enter moves focus up in nav mode', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(2, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: 'Enter', shiftKey: true });
    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });
});

describe('keyboard navigation — edit mode', () => {
  it('Enter during editing commits and moves focus down', () => {
    const onCellChange = vi.fn();
    render(<Grid data={data} columns={columns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'changed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'a', newValue: 'changed' }),
    );
    // Editor closed; focus moved down; no new editor opened.
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
    expect(focusedCellPos()).toEqual({ row: '1', col: 'a' });
  });

  it('Shift+Enter during editing commits and moves focus up', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.doubleClick(findCell(1, 'b'));

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
    expect(focusedCellPos()).toEqual({ row: '0', col: 'b' });
  });

  it('Enter during editing at last row stays at last row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.doubleClick(findCell(2, 'a'));

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(focusedCellPos()).toEqual({ row: '2', col: 'a' });
  });

  it('Enter after Tab inside editor moves down from the *edited* cell, not the clicked one', () => {
    // Regression: handleCommitAndMoveVertical must read editState (current
    // edit target) rather than focusedCell (stuck at the original click),
    // otherwise Tab-then-Enter jumps back to the wrong column.
    render(<Grid data={data} columns={columns} />);
    fireEvent.doubleClick(findCell(0, 'a'));

    // Tab from (0,a) to (0,b) inside the editor (focusedCell stays at (0,a))
    fireEvent.keyDown(document.querySelector('.gs-cell-editor input') as HTMLInputElement, {
      key: 'Tab',
    });

    // Editor moved to 'b'; now Enter should commit from (0,b) and move to (1,b)
    fireEvent.keyDown(document.querySelector('.gs-cell-editor input') as HTMLInputElement, {
      key: 'Enter',
    });

    expect(focusedCellPos()).toEqual({ row: '1', col: 'b' });
  });
});

describe('IME composition safety', () => {
  it('Enter during composition does NOT commit the edit', () => {
    const onCellChange = vi.fn();
    render(<Grid data={data} columns={columns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    // Start composition (e.g. Korean IME opening)
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '한' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Editor still open; no commit fired
    expect(document.querySelector('.gs-cell-editor')).toBeTruthy();
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('Enter after composition ends commits normally', () => {
    const onCellChange = vi.fn();
    render(<Grid data={data} columns={columns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '한' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.compositionEnd(input);

    // Second Enter (after composition ended) should commit.
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'a', newValue: '한' }),
    );
  });

  it('Tab during composition does NOT commit/move', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Tab' });

    // Still editing the same (row, col); editor hasn't moved.
    const stillEditing = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(stillEditing).toBeTruthy();
    // Confirm the editor is at (0, 'a') — value should still reflect original.
    expect(stillEditing.value).toBe('a0');
  });

  it('keyCode 229 (legacy IME sentinel) suppresses commit even without compositionstart', () => {
    const onCellChange = vi.fn();
    render(<Grid data={data} columns={columns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    // Some legacy browsers only set keyCode=229 during composition without
    // populating isComposing. Simulate that case directly.
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });

    expect(onCellChange).not.toHaveBeenCalled();
    expect(document.querySelector('.gs-cell-editor')).toBeTruthy();
  });

  it('Escape during composition still cancels the editor', () => {
    // IME users must have a way to abort; Escape should always work.
    const onCellChange = vi.fn();
    render(<Grid data={data} columns={columns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'a'));
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
    expect(onCellChange).not.toHaveBeenCalled();
  });
});
