import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { Grid } from './grid';
import type { GridColumnDef } from './types';

// ─── DOM mocks ────────────────────────────────────────────

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
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age', header: 'Age', type: 'number' },
  { id: 'active', header: 'Active', type: 'checkbox' },
  { id: 'readonly', header: 'ReadOnly', type: 'text', editable: false },
];

const data = [
  { name: 'Alice', age: 30, active: true, readonly: 'fixed' },
  { name: 'Bob', age: 25, active: false, readonly: 'fixed' },
];

function renderGrid(props?: Partial<Parameters<typeof Grid>[0]>) {
  return render(<Grid data={data} columns={columns} {...props} />);
}

function findCell(row: number, col: string): HTMLElement | null {
  return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

describe('Grid editing integration', () => {
  it('renders data-row and data-col attributes on cells', () => {
    renderGrid();
    const cell = findCell(0, 'name');
    expect(cell).toBeTruthy();
    expect(cell!.textContent).toBe('Alice');
  });

  it('opens editor on double-click', () => {
    renderGrid();
    const cell = findCell(0, 'name')!;
    fireEvent.doubleClick(cell);

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();

    const input = editor!.querySelector('input');
    expect(input).toBeTruthy();
    expect(input!.value).toBe('Alice');
  });

  it('does not open editor on double-click for read-only columns', () => {
    renderGrid();
    const cell = findCell(0, 'readonly')!;
    fireEvent.doubleClick(cell);

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeNull();
  });

  it('commits edit on Enter', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    const cell = findCell(0, 'name')!;

    // Double-click to open editor
    fireEvent.doubleClick(cell);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Change value and press Enter
    fireEvent.change(input, { target: { value: 'Eve' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        col: 'name',
        newValue: 'Eve',
      }),
    );

    // Editor should be closed
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('cancels edit on Escape', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    const cell = findCell(0, 'name')!;

    fireEvent.doubleClick(cell);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // No data change should have been emitted for this edit
    expect(onCellChange).not.toHaveBeenCalled();
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('toggles checkbox on click', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    const cell = findCell(0, 'active')!;

    fireEvent.click(cell);

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({
        col: 'active',
        oldValue: true,
        newValue: false,
      }),
    );
  });

  it('has tabIndex on the grid root for keyboard focus', () => {
    renderGrid();
    const gridRoot = document.querySelector('.gs-grid');
    expect(gridRoot).toBeTruthy();
    expect(gridRoot!.getAttribute('tabindex')).toBe('0');
  });

  it('preserves in-flight edit value across re-renders', () => {
    // Regression guard: the editor's controlled input must stay in sync with
    // user typing even when the Grid re-renders for unrelated reasons.
    const { rerender } = render(<Grid data={data} columns={columns} />);
    const cell = findCell(0, 'name')!;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Typed' } });

    // Force a re-render unrelated to the edit.
    rerender(<Grid data={data} columns={columns} rowHeight={33} />);

    const inputAfter = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(inputAfter.value).toBe('Typed');
  });
});
