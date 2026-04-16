import { describe, expect, it, vi } from 'vitest';

import { createEditingPlugin } from './editing';
import { createGrid } from './grid';
import type { ColumnDef, EditingPluginApi, Row } from './types';

const columns: ColumnDef[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age', header: 'Age', type: 'number' },
  { id: 'active', header: 'Active', type: 'checkbox' },
  {
    id: 'city',
    header: 'City',
    type: 'select',
    selectOptions: [
      { label: 'Seoul', value: 'Seoul' },
      { label: 'Tokyo', value: 'Tokyo' },
    ],
  },
  { id: 'joined', header: 'Joined', type: 'date' },
  { id: 'readonly', header: 'ReadOnly', type: 'text', editable: false },
];

const data: Row[] = [
  {
    name: 'Alice',
    age: 30,
    active: true,
    city: 'Seoul',
    joined: new Date('2024-01-15'),
    readonly: 'fixed',
  },
  {
    name: 'Bob',
    age: 25,
    active: false,
    city: 'Tokyo',
    joined: new Date('2023-06-01'),
    readonly: 'fixed',
  },
];

function setup() {
  const editingPlugin = createEditingPlugin();
  const grid = createGrid({ data, columns, plugins: [editingPlugin] });
  const api = grid.getPlugin<EditingPluginApi>('editing')!;
  return { grid, api };
}

describe('editing plugin', () => {
  describe('beginEdit', () => {
    it('enters edit mode on an editable cell', () => {
      const { api } = setup();
      const result = api.beginEdit(0, 'name');
      expect(result).toBe(true);
      expect(api.isEditing()).toBe(true);

      const state = api.getEditState();
      expect(state).toEqual({
        rowIndex: 0,
        columnId: 'name',
        value: 'Alice',
        originalValue: 'Alice',
      });
    });

    it('returns false for read-only columns', () => {
      const { api } = setup();
      const result = api.beginEdit(0, 'readonly');
      expect(result).toBe(false);
      expect(api.isEditing()).toBe(false);
    });

    it('supports type-to-edit with initialChar', () => {
      const { api } = setup();
      api.beginEdit(0, 'name', 'X');

      const state = api.getEditState();
      expect(state!.value).toBe('X');
      expect(state!.originalValue).toBe('Alice');
    });

    it('auto-commits previous edit when starting a new one', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');
      api.setValue('Changed');

      api.beginEdit(1, 'name');
      expect(grid.getCell(0, 'name')).toBe('Changed');
      expect(api.getEditState()!.rowIndex).toBe(1);
    });

    it('emits edit:begin event', () => {
      const { grid, api } = setup();
      const handler = vi.fn();
      grid.subscribe('edit:begin', handler);

      api.beginEdit(0, 'name');
      expect(handler).toHaveBeenCalledWith({
        rowIndex: 0,
        columnId: 'name',
        value: 'Alice',
        originalValue: 'Alice',
      });
    });
  });

  describe('commitEdit', () => {
    it('commits value and exits edit mode', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');
      api.setValue('Eve');
      api.commitEdit();

      expect(api.isEditing()).toBe(false);
      expect(grid.getCell(0, 'name')).toBe('Eve');
    });

    it('parses number strings through the number editor', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'age');
      api.setValue('42');
      api.commitEdit();

      expect(grid.getCell(0, 'age')).toBe(42);
    });

    it('parses empty number string as null', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'age');
      api.setValue('');
      api.commitEdit();

      expect(grid.getCell(0, 'age')).toBeNull();
    });

    it('parses date strings through the date editor', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'joined');
      api.setValue('2025-03-15');
      api.commitEdit();

      const cell = grid.getCell(0, 'joined');
      expect(cell).toBeInstanceOf(Date);
      expect((cell as Date).toISOString().slice(0, 10)).toBe('2025-03-15');
    });

    it('emits edit:commit and data:change events', () => {
      const { grid, api } = setup();
      const commitHandler = vi.fn();
      const changeHandler = vi.fn();
      grid.subscribe('edit:commit', commitHandler);
      grid.subscribe('data:change', changeHandler);

      api.beginEdit(0, 'name');
      api.setValue('Eve');
      api.commitEdit();

      expect(commitHandler).toHaveBeenCalledWith({
        rowIndex: 0,
        columnId: 'name',
        oldValue: 'Alice',
        newValue: 'Eve',
      });
      expect(changeHandler).toHaveBeenCalled();
    });

    it('returns false when not editing', () => {
      const { api } = setup();
      expect(api.commitEdit()).toBe(false);
    });
  });

  describe('cancelEdit', () => {
    it('exits edit mode without changing data', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');
      api.setValue('Changed');
      api.cancelEdit();

      expect(api.isEditing()).toBe(false);
      expect(grid.getCell(0, 'name')).toBe('Alice');
    });

    it('emits edit:cancel event', () => {
      const { grid, api } = setup();
      const handler = vi.fn();
      grid.subscribe('edit:cancel', handler);

      api.beginEdit(0, 'name');
      api.cancelEdit();

      expect(handler).toHaveBeenCalledWith({ rowIndex: 0, columnId: 'name' });
    });
  });

  describe('setValue', () => {
    it('updates the edit value', () => {
      const { api } = setup();
      api.beginEdit(0, 'name');
      api.setValue('Updated');

      expect(api.getEditState()!.value).toBe('Updated');
    });

    it('does nothing when not editing', () => {
      const { api } = setup();
      api.setValue('noop');
      expect(api.isEditing()).toBe(false);
    });
  });

  describe('defineEditor', () => {
    it('registers a custom editor', () => {
      const { api } = setup();
      api.defineEditor({
        name: 'rating',
        parse: (raw) => Number(raw),
        format: (v) => `${v}★`,
      });

      const editor = api.getEditor('rating');
      expect(editor).toBeDefined();
      expect(editor!.format!(5)).toBe('5★');
      expect(editor!.parse!('3')).toBe(3);
    });
  });

  describe('built-in editors', () => {
    it('text editor preserves strings', () => {
      const { api } = setup();
      const editor = api.getEditor('text')!;
      expect(editor.parse!('hello')).toBe('hello');
      expect(editor.format!('hello')).toBe('hello');
      expect(editor.format!(null)).toBe('');
    });

    it('number editor parses and formats', () => {
      const { api } = setup();
      const editor = api.getEditor('number')!;
      expect(editor.parse!('42')).toBe(42);
      expect(editor.parse!('3.14')).toBe(3.14);
      expect(editor.parse!('')).toBeNull();
      expect(editor.parse!('abc')).toBeNull();
      expect(editor.format!(42)).toBe('42');
      expect(editor.format!(null)).toBe('');
    });

    it('checkbox editor parses and formats', () => {
      const { api } = setup();
      const editor = api.getEditor('checkbox')!;
      expect(editor.parse!('true')).toBe(true);
      expect(editor.parse!('false')).toBe(false);
      expect(editor.format!(true)).toBe('true');
      expect(editor.format!(false)).toBe('false');
    });

    it('date editor parses ISO date strings', () => {
      const { api } = setup();
      const editor = api.getEditor('date')!;
      const parsed = editor.parse!('2025-03-15');
      expect(parsed).toBeInstanceOf(Date);
      expect(editor.format!(new Date('2025-03-15'))).toBe('2025-03-15');
      expect(editor.format!(null)).toBe('');
      expect(editor.parse!('')).toBeNull();
    });

    it('select editor preserves strings', () => {
      const { api } = setup();
      const editor = api.getEditor('select')!;
      expect(editor.parse!('Seoul')).toBe('Seoul');
      expect(editor.format!('Seoul')).toBe('Seoul');
    });
  });

  describe('cell decorator', () => {
    it('adds gs-cell--editing class to the active cell', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');

      const decorations = grid.getCellDecorations(0, 'name');
      expect(decorations.some((d) => d.className === 'gs-cell--editing')).toBe(true);
    });

    it('does not decorate non-editing cells', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');

      const decorations = grid.getCellDecorations(1, 'name');
      expect(decorations.some((d) => d.className === 'gs-cell--editing')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('clears edit state on destroy', () => {
      const { grid, api } = setup();
      api.beginEdit(0, 'name');
      grid.destroy();

      // After destroy, getEditState should return null
      expect(api.getEditState()).toBeNull();
    });
  });
});
