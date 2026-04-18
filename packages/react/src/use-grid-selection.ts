import type { GridInstance, SelectionPluginApi, SelectionState } from '@gridsmith/core';
import { useCallback, useSyncExternalStore } from 'react';

const EMPTY_SELECTION: SelectionState = { ranges: [], activeCell: null };

export type { SelectionState };

/**
 * Read selection state from the grid. Returns the current ranges and active
 * cell, and re-renders whenever they change. Uses `useSyncExternalStore` so
 * the snapshot/subscribe pair stays atomic under concurrent rendering.
 */
export function useGridSelection(grid: GridInstance): SelectionState {
  const subscribe = useCallback(
    (notify: () => void) => grid.subscribe('selection:change', notify),
    [grid],
  );
  const getSnapshot = useCallback(() => {
    const api = grid.getPlugin<SelectionPluginApi>('selection');
    return api?.getState() ?? EMPTY_SELECTION;
  }, [grid]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
