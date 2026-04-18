import { createGrid, createSelectionPlugin, type SelectionPluginApi } from '@gridsmith/core';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useGridSelection } from './use-grid-selection';

describe('useGridSelection', () => {
  it('returns empty state when the selection plugin is not registered', () => {
    const grid = createGrid({
      data: [{ a: 1 }],
      columns: [{ id: 'a', header: 'A' }],
    });
    const { result } = renderHook(() => useGridSelection(grid));
    expect(result.current.ranges).toEqual([]);
    expect(result.current.activeCell).toBeNull();
    grid.destroy();
  });

  it('reads the current state from the plugin', () => {
    const grid = createGrid({
      data: [{ a: 1, b: 2 }],
      columns: [
        { id: 'a', header: 'A' },
        { id: 'b', header: 'B' },
      ],
      plugins: [createSelectionPlugin()],
    });
    const api = grid.getPlugin<SelectionPluginApi>('selection')!;
    api.selectCell({ row: 0, col: 'b' });

    const { result } = renderHook(() => useGridSelection(grid));
    expect(result.current.activeCell).toEqual({ row: 0, col: 'b' });
    grid.destroy();
  });

  it('re-renders when selection changes', () => {
    const grid = createGrid({
      data: [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ],
      columns: [
        { id: 'a', header: 'A' },
        { id: 'b', header: 'B' },
      ],
      plugins: [createSelectionPlugin()],
    });
    const api = grid.getPlugin<SelectionPluginApi>('selection')!;

    const { result } = renderHook(() => useGridSelection(grid));
    expect(result.current.activeCell).toBeNull();

    act(() => {
      api.selectCell({ row: 1, col: 'a' });
    });
    expect(result.current.activeCell).toEqual({ row: 1, col: 'a' });

    act(() => {
      api.extendTo({ row: 1, col: 'b' });
    });
    expect(result.current.ranges).toEqual([{ startRow: 1, endRow: 1, startCol: 'a', endCol: 'b' }]);

    grid.destroy();
  });
});
