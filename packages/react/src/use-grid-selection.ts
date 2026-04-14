import type { GridInstance } from '@gridsmith/core';

/** Selection state (stub — full implementation in #10). */
export interface SelectionState {
  ranges: readonly [];
  activeCell: null;
}

const EMPTY_SELECTION: SelectionState = { ranges: [], activeCell: null };

/**
 * Read selection state from the grid.
 *
 * Returns an empty selection until the selection plugin lands (#10).
 */
export function useGridSelection(_grid: GridInstance): SelectionState {
  return EMPTY_SELECTION;
}
