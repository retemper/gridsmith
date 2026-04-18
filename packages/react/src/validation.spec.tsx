import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Grid } from './grid';
import type { GridColumnDef } from './types';

// ─── DOM mocks (copied from editing.spec.tsx shape) ───────

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
  {
    id: 'name',
    header: 'Name',
    type: 'text',
    validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
  },
  { id: 'age', header: 'Age', type: 'number' },
];

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

function findCell(row: number, col: string): HTMLElement | null {
  return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

describe('Grid validation integration', () => {
  it('auto-registers the validation plugin', () => {
    render(<Grid data={data} columns={columns} />);
    // A grid where the user hasn't edited anything shouldn't decorate cells
    // as invalid — validation only runs on explicit trigger (commit, setCell).
    const cell = findCell(0, 'name')!;
    expect(cell.classList.contains('gs-cell--invalid')).toBe(false);
  });

  it('decorates an invalid cell after a warn-mode commit', () => {
    const warnColumns: GridColumnDef[] = [
      {
        id: 'name',
        header: 'Name',
        type: 'text',
        validationMode: 'warn',
        validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
      },
      { id: 'age', header: 'Age', type: 'number' },
    ];
    render(<Grid data={data} columns={warnColumns} />);

    const cell = findCell(0, 'name')!;
    // Double-click opens editor
    fireEvent.doubleClick(cell);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(input).toBeTruthy();
    // Clear and commit empty value (invalid)
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const updated = findCell(0, 'name')!;
    expect(updated.classList.contains('gs-cell--invalid')).toBe(true);
    expect(updated.getAttribute('title')).toBe('Required');
    expect(updated.getAttribute('data-validation-message')).toBe('Required');
  });

  it('rejects a reject-mode commit and keeps the original value', () => {
    render(<Grid data={data} columns={columns} />);
    const cell = findCell(0, 'name')!;
    fireEvent.doubleClick(cell);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const after = findCell(0, 'name')!;
    expect(after.textContent).toBe('Alice');
    // Reject-mode rollback never records an error — the value was refused outright.
    expect(after.classList.contains('gs-cell--invalid')).toBe(false);
  });
});
