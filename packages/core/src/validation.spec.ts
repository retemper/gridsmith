import { describe, expect, it, vi } from 'vitest';

import { createEditingPlugin } from './editing';
import { createGrid } from './grid';
import type {
  ColumnDef,
  EditingPluginApi,
  Row,
  ValidationError,
  ValidationPluginApi,
} from './types';
import { createValidationPlugin } from './validation';

const baseColumns: ColumnDef[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age', header: 'Age', type: 'number' },
];

const baseData: Row[] = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

interface Setup {
  grid: ReturnType<typeof createGrid>;
  editing: EditingPluginApi;
  validation: ValidationPluginApi;
}

function setup(columns: ColumnDef[] = baseColumns, data: Row[] = baseData): Setup {
  const grid = createGrid({
    data,
    columns,
    plugins: [createEditingPlugin(), createValidationPlugin()],
  });
  return {
    grid,
    editing: grid.getPlugin<EditingPluginApi>('editing')!,
    validation: grid.getPlugin<ValidationPluginApi>('validation')!,
  };
}

// A tiny controllable deferred so tests can resolve async validators at a
// specific moment — avoids relying on timers or microtask ordering tricks.
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('validation plugin', () => {
  describe('sync validation', () => {
    it('returns true when the cell is valid', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => typeof v === 'string' || 'bad',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      expect(validation.validateCell(0, 'name', 'Carol')).toBe(true);
      expect(validation.getError(0, 'name')).toBeNull();
    });

    it('returns the error message and records it when invalid', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      expect(validation.validateCell(0, 'name', '')).toBe('Required');
      const err = validation.getError(0, 'name');
      expect(err?.message).toBe('Required');
      expect(err?.state).toBe('invalid');
      expect(err?.columnId).toBe('name');
    });

    it('clears a previously recorded error when the cell becomes valid', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (v === 'ok' ? true : 'bad'),
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      validation.validateCell(0, 'name', 'nope');
      expect(validation.getError(0, 'name')).not.toBeNull();
      validation.validateCell(0, 'name', 'ok');
      expect(validation.getError(0, 'name')).toBeNull();
    });

    it('treats a thrown validator as a failure with the exception message', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: () => {
            throw new Error('boom');
          },
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      expect(validation.validateCell(0, 'name', 'x')).toBe('boom');
      expect(validation.getError(0, 'name')?.message).toBe('boom');
    });

    it('ignores columns without a validator', () => {
      const { validation } = setup();
      expect(validation.validateCell(0, 'name', 'anything')).toBe(true);
      expect(validation.getError(0, 'name')).toBeNull();
    });
  });

  describe('validation:change event', () => {
    it('fires once when a verdict changes and is quiet on no-op re-validation', () => {
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (v === 'ok' ? true : 'bad'),
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      const spy = vi.fn();
      grid.subscribe('validation:change', spy);

      validation.validateCell(0, 'name', 'nope'); // fresh error → emits
      validation.validateCell(0, 'name', 'nope'); // same verdict → no-op
      expect(spy).toHaveBeenCalledTimes(1);

      validation.validateCell(0, 'name', 'ok'); // clears → emits
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('async validation', () => {
    it('marks the cell pending then invalid when async resolves with an error', async () => {
      const d = deferred<true | string>();
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => d.promise,
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);

      const p = validation.validateCellAsync(0, 'name', 'x');
      expect(validation.isPending(0, 'name')).toBe(true);
      d.resolve('Taken');
      const result = await p;
      expect(result).toBe('Taken');
      const err = validation.getError(0, 'name');
      expect(err?.state).toBe('invalid');
      expect(err?.message).toBe('Taken');
    });

    it('clears the pending record when async resolves valid', async () => {
      const d = deferred<true | string>();
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => d.promise,
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);

      const p = validation.validateCellAsync(0, 'name', 'x');
      expect(validation.isPending(0, 'name')).toBe(true);
      d.resolve(true);
      await p;
      expect(validation.getError(0, 'name')).toBeNull();
    });

    it('treats a rejecting async validator as a failure with the exception message', async () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => Promise.reject(new Error('upstream down')),
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      const result = await validation.validateCellAsync(0, 'name', 'x');
      expect(result).toBe('upstream down');
      expect(validation.getError(0, 'name')?.message).toBe('upstream down');
    });

    it('kicks off async validation from the sync `validateCell` entry point', async () => {
      // Wrap the validator so the test can await its full resolution chain.
      let settled!: Promise<true | string>;
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => {
            settled = Promise.resolve('async fail' as const);
            return settled;
          },
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      // Listen for the change event triggered when the async result lands.
      const settledEvent = new Promise<void>((resolve) => {
        const off = grid.subscribe('validation:change', ({ errors }) => {
          if (errors.some((e) => e.state === 'invalid')) {
            off();
            resolve();
          }
        });
      });
      // Sync path returns true; async runs in the background.
      expect(validation.validateCell(0, 'name', 'x')).toBe(true);
      await settledEvent;
      expect(validation.getError(0, 'name')?.message).toBe('async fail');
    });

    it('discards stale async results when a newer validation supersedes them', async () => {
      const first = deferred<true | string>();
      const second = deferred<true | string>();
      let calls = 0;
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => {
            calls++;
            return calls === 1 ? first.promise : second.promise;
          },
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);

      const p1 = validation.validateCellAsync(0, 'name', 'a');
      const p2 = validation.validateCellAsync(0, 'name', 'b');
      // Resolve the stale one last — the later attempt's verdict must win.
      second.resolve(true);
      first.resolve('stale error');
      await Promise.all([p1, p2]);
      expect(validation.getError(0, 'name')).toBeNull();
    });
  });

  describe('editing integration', () => {
    it('rejects the commit in reject mode when sync validation fails', () => {
      const { grid, editing } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      editing.beginEdit(0, 'name');
      editing.setValue('');
      const cancelSpy = vi.fn();
      grid.subscribe('edit:cancel', cancelSpy);
      const ok = editing.commitEdit();
      expect(ok).toBe(false);
      expect(grid.getCell(0, 'name')).toBe('Alice');
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('commits in warn mode even when the value is invalid', () => {
      const { grid, editing, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validationMode: 'warn',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      editing.beginEdit(0, 'name');
      editing.setValue('');
      const ok = editing.commitEdit();
      expect(ok).toBe(true);
      expect(grid.getCell(0, 'name')).toBe('');
      expect(validation.getError(0, 'name')?.message).toBe('Required');
    });

    it('clears the error when a subsequent edit fixes the value', () => {
      const { editing, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validationMode: 'warn',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      editing.beginEdit(0, 'name');
      editing.setValue('');
      editing.commitEdit();
      expect(validation.getError(0, 'name')).not.toBeNull();

      editing.beginEdit(0, 'name');
      editing.setValue('fine');
      editing.commitEdit();
      expect(validation.getError(0, 'name')).toBeNull();
    });
  });

  describe('decoration', () => {
    it('decorates an invalid cell with the error class and data attributes', () => {
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      validation.validateCell(0, 'name', '');
      const decorations = grid.getCellDecorations(0, 'name');
      expect(decorations).toHaveLength(1);
      expect(decorations[0].className).toBe('gs-cell--invalid');
      expect(decorations[0].attributes?.['data-validation-state']).toBe('invalid');
      expect(decorations[0].attributes?.['data-validation-message']).toBe('Required');
    });

    it('decorates a pending cell with the validating class', () => {
      const d = deferred<true | string>();
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => d.promise,
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      void validation.validateCellAsync(0, 'name', 'x');
      const decorations = grid.getCellDecorations(0, 'name');
      expect(decorations).toHaveLength(1);
      expect(decorations[0].className).toBe('gs-cell--validating');
      d.resolve(true);
    });
  });

  describe('data:change integration', () => {
    it('re-validates on setCell from outside the editing pipeline', () => {
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      grid.setCell(0, 'name', '');
      expect(validation.getError(0, 'name')?.message).toBe('Required');
      grid.setCell(0, 'name', 'fixed');
      expect(validation.getError(0, 'name')).toBeNull();
    });

    it('runs async validators on writes from outside the editing pipeline', async () => {
      const { grid, validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          asyncValidate: () => Promise.resolve('async fail' as const),
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      const settledEvent = new Promise<void>((resolve) => {
        const off = grid.subscribe('validation:change', ({ errors }) => {
          if (errors.some((e) => e.state === 'invalid')) {
            off();
            resolve();
          }
        });
      });
      grid.setCell(0, 'name', 'x');
      await settledEvent;
      expect(validation.getError(0, 'name')?.message).toBe('async fail');
    });

    it('re-validates writes to currently-hidden rows via setCellByDataIndex', () => {
      const { grid, validation } = setup(
        [
          {
            id: 'name',
            header: 'Name',
            type: 'text',
            validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
          },
          { id: 'age', header: 'Age', type: 'number' },
        ],
        [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      );
      // Filter to "Alice" only — data index 1 (Bob) is hidden.
      grid.filterState.set([{ columnId: 'name', operator: 'eq', value: 'Alice' }]);
      grid.setCellByDataIndex(1, 'name', '');

      // Errors are keyed by data-index, so the snapshot reflects the
      // hidden row's new state even though it isn't in the view.
      const all = validation.getErrors();
      expect(all).toHaveLength(1);
      expect(all[0].dataIndex).toBe(1);
      expect(all[0].message).toBe('Required');
    });
  });

  describe('validateAll', () => {
    it('returns every failing cell across the data set', async () => {
      const { validation } = setup(
        [
          {
            id: 'name',
            header: 'Name',
            type: 'text',
            validate: (v) => (typeof v === 'string' && v.length >= 3) || 'Too short',
          },
          { id: 'age', header: 'Age', type: 'number' },
        ],
        [
          { name: 'Al', age: 30 },
          { name: 'Bob', age: 25 },
          { name: 'Jo', age: 40 },
        ],
      );
      const errors = await validation.validateAll();
      expect(errors).toHaveLength(2);
      const ids = errors.map((e: ValidationError) => e.dataIndex).sort();
      expect(ids).toEqual([0, 2]);
    });

    it('still validates rows that are filtered out of the view', async () => {
      const { grid, validation } = setup(
        [
          {
            id: 'name',
            header: 'Name',
            type: 'text',
            validate: (v) => (typeof v === 'string' && v.length >= 3) || 'Too short',
          },
          { id: 'age', header: 'Age', type: 'number' },
        ],
        [
          { name: 'Al', age: 30 }, // invalid, filtered out
          { name: 'Bob', age: 25 }, // valid, visible
          { name: 'Jo', age: 40 }, // invalid, filtered out
        ],
      );
      // Filter to only "Bob" — leaves data indices 0 and 2 hidden.
      grid.filterState.set([{ columnId: 'name', operator: 'eq', value: 'Bob' }]);
      expect(grid.indexMap.get().length).toBe(1);

      const errors = await validation.validateAll();
      const ids = errors.map((e: ValidationError) => e.dataIndex).sort();
      // Without the data-index walk, viewToData(2) would throw RangeError
      // here because the filtered view only has length 1.
      expect(ids).toEqual([0, 2]);
    });
  });

  describe('clearErrors', () => {
    it('drops recorded errors at various scopes', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        {
          id: 'age',
          header: 'Age',
          type: 'number',
          validate: (v) => typeof v === 'number' || 'NaN',
        },
      ]);
      validation.validateCell(0, 'name', '');
      validation.validateCell(1, 'name', '');
      validation.validateCell(0, 'age', null);
      expect(validation.getErrors()).toHaveLength(3);

      validation.clearErrors(0, 'name');
      expect(validation.getErrors()).toHaveLength(2);

      validation.clearErrors(0);
      expect(validation.getErrors()).toHaveLength(1);

      validation.clearErrors();
      expect(validation.getErrors()).toHaveLength(0);
    });

    it('clears every error on a column when only columnId is passed', () => {
      const { validation } = setup([
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        },
        {
          id: 'age',
          header: 'Age',
          type: 'number',
          validate: (v) => typeof v === 'number' || 'NaN',
        },
      ]);
      validation.validateCell(0, 'name', '');
      validation.validateCell(1, 'name', '');
      validation.validateCell(0, 'age', null);
      expect(validation.getErrors()).toHaveLength(3);

      validation.clearErrors(undefined, 'name');
      const remaining = validation.getErrors();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].columnId).toBe('age');
    });
  });

  describe('change-event dedupe', () => {
    it('does not re-emit when the same error is recorded with a fresh Date value', () => {
      const { grid, validation } = setup([
        {
          id: 'joined',
          header: 'Joined',
          type: 'date',
          // Always fails — we want two failing calls with structurally equal
          // Date values to confirm the dedupe path treats them as equal.
          validate: () => 'Locked',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ]);
      const spy = vi.fn();
      grid.subscribe('validation:change', spy);

      validation.validateCell(0, 'joined', new Date('2026-04-19')); // emits
      // Second call uses a different Date instance with the same epoch —
      // `Object.is` would say they're unequal, so without Date-aware equality
      // the dedupe would miss and a second event would fire.
      validation.validateCell(0, 'joined', new Date('2026-04-19')); // no-op
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
