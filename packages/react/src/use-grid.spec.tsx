import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GridColumnDef } from './types';
import { useGrid } from './use-grid';

const columns: GridColumnDef[] = [
  { id: 'name', header: 'Name' },
  { id: 'age', header: 'Age', type: 'number' },
];

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

describe('useGrid', () => {
  it('creates a grid instance with provided data', () => {
    const { result } = renderHook(() => useGrid({ data, columns }));
    expect(result.current).toBeDefined();
    expect(result.current.getCell(0, 'name')).toBe('Alice');
    expect(result.current.getCell(1, 'age')).toBe(25);
  });

  it('returns the same instance across re-renders', () => {
    const { result, rerender } = renderHook(() => useGrid({ data, columns }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('syncs data when reference changes', () => {
    const { result, rerender } = renderHook(
      (props: { data: typeof data }) => useGrid({ data: props.data, columns }),
      { initialProps: { data } },
    );
    expect(result.current.rowCount).toBe(2);

    const newData = [...data, { name: 'Charlie', age: 35 }];
    rerender({ data: newData });
    expect(result.current.rowCount).toBe(3);
    expect(result.current.getCell(2, 'name')).toBe('Charlie');
  });

  it('syncs columns when content changes', () => {
    const { result, rerender } = renderHook(
      (props: { columns: GridColumnDef[] }) => useGrid({ data, columns: props.columns }),
      { initialProps: { columns } },
    );
    expect(result.current.columns.get()).toHaveLength(2);

    const newColumns: GridColumnDef[] = [...columns, { id: 'email', header: 'Email' }];
    rerender({ columns: newColumns });
    expect(result.current.columns.get()).toHaveLength(3);
  });

  it('strips cellRenderer from columns before passing to core', () => {
    const colsWithRenderer: GridColumnDef[] = [
      { id: 'name', header: 'Name', cellRenderer: () => null },
    ];
    const { result } = renderHook(() => useGrid({ data, columns: colsWithRenderer }));
    const coreCol = result.current.columns.get()[0];
    expect(coreCol).not.toHaveProperty('cellRenderer');
  });

  it('does not re-sync data when reference is the same', () => {
    const { result, rerender } = renderHook(() => useGrid({ data, columns }));
    const spy = vi.spyOn(result.current, 'setData');
    rerender();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not re-sync columns when content is unchanged', () => {
    const { result, rerender } = renderHook(
      (props: { columns: GridColumnDef[] }) => useGrid({ data, columns: props.columns }),
      { initialProps: { columns } },
    );
    const spy = vi.spyOn(result.current, 'setColumns');
    // New array, same content
    rerender({ columns: [{ ...columns[0] }, { ...columns[1] }] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits data:rowsUpdate event when data is synced', () => {
    const handler = vi.fn();
    const { result, rerender } = renderHook(
      (props: { data: typeof data }) => useGrid({ data: props.data, columns }),
      { initialProps: { data } },
    );
    result.current.subscribe('data:rowsUpdate', handler);

    const newData = [{ name: 'Charlie', age: 35 }];
    rerender({ data: newData });
    expect(handler).toHaveBeenCalled();
  });
});
