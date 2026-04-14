import { createGrid } from '@gridsmith/core';
import { describe, expect, it } from 'vitest';

import { useGridSelection } from './use-grid-selection';

describe('useGridSelection', () => {
  it('returns empty selection state', () => {
    const grid = createGrid({
      data: [{ a: 1 }],
      columns: [{ id: 'a', header: 'A' }],
    });
    const state = useGridSelection(grid);
    expect(state.ranges).toEqual([]);
    expect(state.activeCell).toBeNull();
    grid.destroy();
  });
});
