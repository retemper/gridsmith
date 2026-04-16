import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { Grid } from './grid';
import type { CellEditorProps, GridColumnDef } from './types';

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

function getGridRoot(): HTMLElement {
  const root = document.querySelector('.gs-grid');
  if (!root) throw new Error('Grid root not found');
  return root as HTMLElement;
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

  it('toggles checkbox on double-click', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    const cell = findCell(1, 'active')!;

    fireEvent.doubleClick(cell);

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'active', oldValue: false, newValue: true }),
    );
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
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

  it('opens number editor on double-click and commits numeric value', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    const cell = findCell(0, 'age')!;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('30');
    expect(input.inputMode).toBe('numeric');

    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'age', newValue: 42 }),
    );
  });

  it('opens select editor with options on double-click', () => {
    const selectColumns: GridColumnDef[] = [
      {
        id: 'status',
        header: 'Status',
        type: 'select',
        selectOptions: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ];
    const selectData = [{ status: 'active' }, { status: 'inactive' }];
    const onCellChange = vi.fn();

    render(<Grid data={selectData} columns={selectColumns} onCellChange={onCellChange} />);

    const cell = findCell(0, 'status')!;
    fireEvent.doubleClick(cell);

    const select = document.querySelector('.gs-cell-editor select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('active');
    expect(select.options).toHaveLength(2);

    // Selecting a new value auto-commits.
    fireEvent.change(select, { target: { value: 'inactive' } });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'status', newValue: 'inactive' }),
    );
  });

  it('opens date editor on double-click', () => {
    const dateColumns: GridColumnDef[] = [{ id: 'dob', header: 'DOB', type: 'date' }];
    const dateData = [{ dob: new Date('2020-01-15') }];

    render(<Grid data={dateData} columns={dateColumns} />);

    const cell = findCell(0, 'dob')!;
    fireEvent.doubleClick(cell);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('date');
  });

  it('uses custom cellEditor when provided', () => {
    const customColumns: GridColumnDef[] = [
      {
        id: 'name',
        header: 'Name',
        type: 'text',
        cellEditor: ({ value, commit, cancel }: CellEditorProps) => (
          <div className="custom-editor">
            <button type="button" onClick={() => commit('CUSTOM')}>
              set
            </button>
            <button type="button" onClick={cancel}>
              cancel
            </button>
            <span>{String(value)}</span>
          </div>
        ),
      },
    ];
    const onCellChange = vi.fn();
    render(<Grid data={[{ name: 'Old' }]} columns={customColumns} onCellChange={onCellChange} />);

    const cell = findCell(0, 'name')!;
    fireEvent.doubleClick(cell);

    const custom = document.querySelector('.custom-editor');
    expect(custom).toBeTruthy();

    const setBtn = custom!.querySelectorAll('button')[0]!;
    fireEvent.click(setBtn);

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', newValue: 'CUSTOM' }),
    );
  });

  it('custom cellEditor cancel callback closes the editor without change', () => {
    const customColumns: GridColumnDef[] = [
      {
        id: 'name',
        header: 'Name',
        type: 'text',
        cellEditor: ({ cancel }: CellEditorProps) => (
          <button className="cancel-btn" type="button" onClick={cancel}>
            cancel
          </button>
        ),
      },
    ];
    const onCellChange = vi.fn();
    render(<Grid data={[{ name: 'Old' }]} columns={customColumns} onCellChange={onCellChange} />);

    fireEvent.doubleClick(findCell(0, 'name')!);
    const btn = document.querySelector('.cancel-btn')!;
    fireEvent.click(btn);

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('F2 opens editor on focused cell', () => {
    renderGrid();
    const cell = findCell(0, 'name')!;
    fireEvent.click(cell); // focus

    const gridRoot = getGridRoot();
    fireEvent.keyDown(gridRoot, { key: 'F2' });

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();
    expect(editor!.querySelector('input')!.value).toBe('Alice');
  });

  it('Enter opens editor on focused non-checkbox cell', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'name')!);

    fireEvent.keyDown(getGridRoot(), { key: 'Enter' });

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();
  });

  it('Enter toggles checkbox on focused cell', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.click(findCell(1, 'active')!); // toggles once on click

    onCellChange.mockClear();
    fireEvent.keyDown(getGridRoot(), { key: 'Enter' });

    expect(onCellChange).toHaveBeenCalledWith(expect.objectContaining({ col: 'active' }));
  });

  it('Delete clears focused cell value', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.click(findCell(0, 'name')!);

    fireEvent.keyDown(getGridRoot(), { key: 'Delete' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', oldValue: 'Alice', newValue: null }),
    );
  });

  it('Backspace clears focused cell value', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.click(findCell(0, 'name')!);

    fireEvent.keyDown(getGridRoot(), { key: 'Backspace' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', oldValue: 'Alice', newValue: null }),
    );
  });

  it('Delete on read-only cell is a no-op', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.click(findCell(0, 'readonly')!);

    fireEvent.keyDown(getGridRoot(), { key: 'Delete' });

    expect(onCellChange).not.toHaveBeenCalled();
  });

  it('type-to-edit starts editor with typed character', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'name')!);

    fireEvent.keyDown(getGridRoot(), { key: 'x' });

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();
    const input = editor!.querySelector('input') as HTMLInputElement;
    // beginEdit(row, col, 'x') sets the initial value to 'x'
    expect(input.value).toBe('x');
  });

  it('type-to-edit accepts digits on number columns', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'age')!);

    fireEvent.keyDown(getGridRoot(), { key: '5' });

    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();
    const input = editor!.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('5');
  });

  it('type-to-edit rejects non-numeric characters on number columns', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'age')!);

    fireEvent.keyDown(getGridRoot(), { key: 'x' });

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('type-to-edit is a no-op on checkbox columns', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'active')!); // this toggles it; clear first
    fireEvent.click(findCell(1, 'active')!);

    fireEvent.keyDown(getGridRoot(), { key: 'a' });

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('type-to-edit ignores modifier keys', () => {
    renderGrid();
    fireEvent.click(findCell(0, 'name')!);

    fireEvent.keyDown(getGridRoot(), { key: 'a', ctrlKey: true });

    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('keydown with no focused cell is a no-op', () => {
    renderGrid();

    // No focused cell yet
    expect(() => fireEvent.keyDown(getGridRoot(), { key: 'F2' })).not.toThrow();
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('does not re-trigger key handling while editing', () => {
    renderGrid();
    fireEvent.doubleClick(findCell(0, 'name')!);

    // The root key handler should bail early; the editor input handles keys.
    expect(() => fireEvent.keyDown(getGridRoot(), { key: 'F2' })).not.toThrow();

    // Editor is still open (no second beginEdit side effect)
    expect(document.querySelector('.gs-cell-editor')).toBeTruthy();
  });

  it('Tab commits and moves to next editable column', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.doubleClick(findCell(0, 'name')!);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Next' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', newValue: 'Next' }),
    );

    // Editor should move to the 'age' column (next editable) on row 0
    const editor = document.querySelector('.gs-cell-editor');
    expect(editor).toBeTruthy();
    const nextInput = editor!.querySelector('input') as HTMLInputElement;
    expect(nextInput.value).toBe('30');
  });

  it('Shift+Tab moves to previous editable column', () => {
    renderGrid();
    fireEvent.doubleClick(findCell(0, 'age')!);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });

    // Should move back to 'name' on row 0
    const nextInput = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    expect(nextInput.value).toBe('Alice');
  });

  it('Tab from last editable column wraps to first column of next row', () => {
    // Columns in order: name, age, active (checkbox — editor skips), readonly (not editable)
    // Editable columns: [name, age] (checkbox is filtered by visible/editable default true,
    // but handleTab does NOT special-case checkbox; it only filters editable!==false.)
    // Pick a simpler fixture to avoid checkbox filtering complexity.
    const cols: GridColumnDef[] = [
      { id: 'a', header: 'A', type: 'text' },
      { id: 'b', header: 'B', type: 'text' },
    ];
    const rows = [
      { a: 'a0', b: 'b0' },
      { a: 'a1', b: 'b1' },
    ];
    render(<Grid data={rows} columns={cols} />);

    fireEvent.doubleClick(findCell(0, 'b')!);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Tab' });

    const next = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    // Wraps to first editable on next row → (1, 'a')
    expect(next.value).toBe('a1');
  });

  it('Shift+Tab from first editable column wraps to last column of previous row', () => {
    const cols: GridColumnDef[] = [
      { id: 'a', header: 'A', type: 'text' },
      { id: 'b', header: 'B', type: 'text' },
    ];
    const rows = [
      { a: 'a0', b: 'b0' },
      { a: 'a1', b: 'b1' },
    ];
    render(<Grid data={rows} columns={cols} />);

    fireEvent.doubleClick(findCell(1, 'a')!);
    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });

    const next = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    // Wraps to last editable on previous row → (0, 'b')
    expect(next.value).toBe('b0');
  });

  it('clicking a different cell while editing commits the current edit', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.doubleClick(findCell(0, 'name')!);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Committed' } });

    // Click a different cell while editing
    fireEvent.click(findCell(1, 'name')!);

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', newValue: 'Committed' }),
    );
  });

  it('focused cell is cleared on sort change', () => {
    // Use controlled sort so we can flip sortState without user interaction.
    const { rerender } = render(<Grid data={data} columns={columns} sortState={[]} />);

    fireEvent.click(findCell(0, 'name')!);

    // Now change sort; focusedCell should be cleared (F2 should be a no-op).
    act(() => {
      rerender(
        <Grid data={data} columns={columns} sortState={[{ columnId: 'name', direction: 'asc' }]} />,
      );
    });

    fireEvent.keyDown(getGridRoot(), { key: 'F2' });
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('focused cell is cleared on filter change', () => {
    const { rerender } = render(<Grid data={data} columns={columns} filterState={[]} />);

    fireEvent.click(findCell(0, 'name')!);

    act(() => {
      rerender(
        <Grid
          data={data}
          columns={columns}
          filterState={[{ columnId: 'name', operator: 'contains', value: 'A' }]}
        />,
      );
    });

    fireEvent.keyDown(getGridRoot(), { key: 'F2' });
    expect(document.querySelector('.gs-cell-editor')).toBeNull();
  });

  it('commits on blur of text editor', () => {
    const onCellChange = vi.fn();
    renderGrid({ onCellChange });
    fireEvent.doubleClick(findCell(0, 'name')!);

    const input = document.querySelector('.gs-cell-editor input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);

    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'name', newValue: 'Blurred' }),
    );
  });
});
