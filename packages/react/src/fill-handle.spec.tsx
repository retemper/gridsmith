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
      return 600;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 400;
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
  { id: 'a', header: 'A', type: 'number' },
  { id: 'b', header: 'B', type: 'number' },
  { id: 'c', header: 'C', type: 'number' },
];

function data(rows: number) {
  const out: Array<Record<string, number | null>> = [];
  for (let i = 0; i < rows; i++) out.push({ a: null, b: null, c: null });
  return out;
}

function findCell(row: number, col: string): HTMLElement {
  const el = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (!el) throw new Error(`cell (${row}, ${col}) not found`);
  return el as HTMLElement;
}

function getFillHandle(): HTMLElement | null {
  return document.querySelector('.gs-fill-handle') as HTMLElement | null;
}

describe('Grid fill handle', () => {
  it('renders the fill handle when a selection exists', () => {
    render(<Grid data={data(4)} columns={columns} />);
    expect(getFillHandle()).toBeNull();
    fireEvent.mouseDown(findCell(0, 'a'), { button: 0 });
    fireEvent.mouseUp(findCell(0, 'a'));
    expect(getFillHandle()).not.toBeNull();
  });

  it('hides the handle during editing', () => {
    render(<Grid data={data(4)} columns={columns} />);
    fireEvent.mouseDown(findCell(0, 'a'), { button: 0 });
    fireEvent.mouseUp(findCell(0, 'a'));
    expect(getFillHandle()).not.toBeNull();
    // Enter edit mode via double-click.
    fireEvent.doubleClick(findCell(0, 'a'));
    expect(getFillHandle()).toBeNull();
  });

  it('fills a numeric series down when dragging to a lower row', () => {
    const initial = [{ a: 1 }, { a: 2 }, { a: null }, { a: null }, { a: null }];
    const onCellChange = vi.fn();
    render(
      <Grid
        data={initial}
        columns={[{ id: 'a', header: 'A', type: 'number' }]}
        onCellChange={onCellChange}
      />,
    );

    // Select rows 0–1 in column 'a'. `buttons: 1` is required — the drag
    // extender bails when the primary button isn't held.
    fireEvent.mouseDown(findCell(0, 'a'), { button: 0 });
    fireEvent.mouseMove(findCell(1, 'a'), { buttons: 1 });
    fireEvent.mouseUp(findCell(1, 'a'));

    const handle = getFillHandle();
    expect(handle).not.toBeNull();

    // Drag the handle down to row 4. jsdom does not implement
    // `document.elementFromPoint`, so we define it ourselves for the test.
    const targetCell = findCell(4, 'a');
    (
      document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
    ).elementFromPoint = () => targetCell;

    fireEvent.pointerDown(handle!, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle!, { pointerId: 1, clientX: 0, clientY: 200 });
    fireEvent.pointerUp(handle!, { pointerId: 1, clientX: 0, clientY: 200 });

    // Rows 2, 3, 4 should have been filled with 3, 4, 5.
    const changes = onCellChange.mock.calls.map((c) => c[0]);
    const byRow = new Map<number, unknown>();
    for (const c of changes) byRow.set(c.row, c.newValue);
    expect(byRow.get(2)).toBe(3);
    expect(byRow.get(3)).toBe(4);
    expect(byRow.get(4)).toBe(5);
  });

  it('does not apply a fill when the pointer never left the source', () => {
    const initial = [{ a: 10 }, { a: null }];
    const onCellChange = vi.fn();
    render(
      <Grid
        data={initial}
        columns={[{ id: 'a', header: 'A', type: 'number' }]}
        onCellChange={onCellChange}
      />,
    );
    fireEvent.mouseDown(findCell(0, 'a'), { button: 0 });
    fireEvent.mouseUp(findCell(0, 'a'));

    const handle = getFillHandle()!;
    const sourceCell = findCell(0, 'a');
    (
      document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
    ).elementFromPoint = () => sourceCell;

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onCellChange).not.toHaveBeenCalled();
  });
});
