import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Grid } from './grid';
import type { GridColumnDef } from './types';

// ─── DOM mocks ─────────────────────────────────────────────

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

// ─── Fixtures ──────────────────────────────────────────────

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

function selectedCellKeys(): string[] {
  const out: string[] = [];
  document.querySelectorAll('.gs-cell--selected').forEach((el) => {
    const e = el as HTMLElement;
    out.push(`${e.dataset.row},${e.dataset.col}`);
  });
  return out.sort();
}

function activeCellKey(): string | null {
  const el = document.querySelector('.gs-cell--active') as HTMLElement | null;
  if (!el) return null;
  return `${el.dataset.row},${el.dataset.col}`;
}

function getGridRoot(): HTMLElement {
  const root = document.querySelector('.gs-grid');
  if (!root) throw new Error('Grid root not found');
  return root as HTMLElement;
}

// ─── Tests ─────────────────────────────────────────────────

describe('range selection — mouse', () => {
  it('single click selects one cell and marks it active', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'b'));
    expect(activeCellKey()).toBe('1,b');
    expect(selectedCellKeys()).toEqual(['1,b']);
  });

  it('shift+click extends the active range', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.click(findCell(2, 'c'), { shiftKey: true });
    // 3×3 block from (0,a) to (2,c)
    expect(selectedCellKeys()).toEqual(
      ['0,a', '0,b', '0,c', '1,a', '1,b', '1,c', '2,a', '2,b', '2,c'].sort(),
    );
    expect(activeCellKey()).toBe('2,c');
  });

  it('ctrl/cmd+click adds a new range without clearing the prior', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.click(findCell(2, 'c'), { ctrlKey: true });
    expect(selectedCellKeys()).toEqual(['0,a', '2,c']);
    expect(activeCellKey()).toBe('2,c');
  });

  it('drag selects a contiguous range', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.mouseDown(findCell(0, 'a'), { button: 0 });
    fireEvent.mouseMove(findCell(1, 'b'), { buttons: 1 });
    fireEvent.mouseUp(findCell(1, 'b'));
    fireEvent.click(findCell(1, 'b'));
    expect(selectedCellKeys()).toEqual(['0,a', '0,b', '1,a', '1,b']);
    expect(activeCellKey()).toBe('1,b');
  });

  it('mousedown moves keyboard focus into the grid root', () => {
    render(<Grid data={data} columns={columns} />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.mouseDown(findCell(1, 'b'), { button: 0 });
    expect(document.activeElement).toBe(getGridRoot());
  });
});

describe('range selection — keyboard', () => {
  it('shift+arrow extends the selection from the active cell', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(getGridRoot(), { key: 'ArrowDown', shiftKey: true });
    expect(selectedCellKeys()).toEqual(['0,a', '0,b', '1,a', '1,b']);
    expect(activeCellKey()).toBe('1,b');
  });

  it('ctrl/cmd+A selects all cells', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.keyDown(getGridRoot(), { key: 'a', ctrlKey: true });
    expect(selectedCellKeys()).toEqual(
      ['0,a', '0,b', '0,c', '1,a', '1,b', '1,c', '2,a', '2,b', '2,c'].sort(),
    );
  });

  it('ctrl/cmd+A is ignored when a sibling text input has focus', () => {
    render(<Grid data={data} columns={columns} />);
    // Simulate a foreign input nested inside the grid — e.g. a filter popover
    // textbox. Ctrl+A there should select the input's text, not all cells.
    const root = getGridRoot();
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
    fireEvent.click(findCell(1, 'b'));
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    expect(selectedCellKeys()).toEqual(['1,b']);
  });

  it('shift+space selects the active row', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: ' ', shiftKey: true });
    expect(selectedCellKeys()).toEqual(['1,a', '1,b', '1,c']);
  });

  it('ctrl+space selects the active column', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(1, 'b'));
    fireEvent.keyDown(getGridRoot(), { key: ' ', ctrlKey: true });
    expect(selectedCellKeys()).toEqual(['0,b', '1,b', '2,b']);
  });

  it('Escape clears the selection', () => {
    render(<Grid data={data} columns={columns} />);
    fireEvent.click(findCell(0, 'a'));
    fireEvent.click(findCell(2, 'c'), { shiftKey: true });
    expect(selectedCellKeys().length).toBe(9);
    fireEvent.keyDown(getGridRoot(), { key: 'Escape' });
    expect(selectedCellKeys()).toEqual([]);
    expect(activeCellKey()).toBeNull();
  });
});

describe('range selection — header click', () => {
  it('clicking a column header selects the column', () => {
    render(<Grid data={data} columns={columns} />);
    const labels = document.querySelectorAll('.gs-header-label');
    fireEvent.click(labels[1]);
    expect(selectedCellKeys()).toEqual(['0,b', '1,b', '2,b']);
  });

  it('cmd+clicking a header adds the column to the selection', () => {
    render(<Grid data={data} columns={columns} />);
    const labels = document.querySelectorAll('.gs-header-label');
    fireEvent.click(labels[0]);
    fireEvent.click(labels[2], { ctrlKey: true });
    expect(selectedCellKeys()).toEqual(['0,a', '0,c', '1,a', '1,c', '2,a', '2,c']);
  });
});

describe('range selection — clearing', () => {
  it('clears when sort changes', () => {
    // Drive sort via the controlled prop so the assertion isolates the
    // "sort:change clears selection" path from the header click that *also*
    // re-selects the clicked column.
    const { rerender } = render(<Grid data={data} columns={columns} sortState={[]} />);
    fireEvent.click(findCell(1, 'b'));
    expect(activeCellKey()).toBe('1,b');
    expect(selectedCellKeys()).toEqual(['1,b']);
    rerender(
      <Grid data={data} columns={columns} sortState={[{ columnId: 'a', direction: 'asc' }]} />,
    );
    expect(activeCellKey()).toBeNull();
    expect(selectedCellKeys()).toEqual([]);
  });
});
