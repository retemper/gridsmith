import type { SortState, SortDirection } from '@gridsmith/core';

/**
 * Compute the next sort state after a header click.
 *
 * - Plain click cycles a single column through asc → desc → none.
 *   If a different column was previously sorted, it is replaced.
 * - Shift-click adds/toggles the column into a multi-column sort without
 *   disturbing the order of existing entries. Shift-clicking a currently
 *   descending column removes it.
 *
 * Split out from the Grid component for testability — multi-column sort
 * cycling has enough edge cases that it's worth isolating.
 */
export function cycleSortState(current: SortState, columnId: string, shift: boolean): SortState {
  const existingIdx = current.findIndex((e) => e.columnId === columnId);
  const existing = existingIdx === -1 ? undefined : current[existingIdx];
  const nextDir: SortDirection | null = existing
    ? existing.direction === 'asc'
      ? 'desc'
      : null
    : 'asc';

  if (!shift) {
    // Single-column mode: replace entire sort state.
    if (nextDir === null) return [];
    return [{ columnId, direction: nextDir }];
  }

  // Multi-column mode: preserve the order of entries except for this column.
  const preserved = current.filter((e) => e.columnId !== columnId);
  if (nextDir === null) return preserved;
  return existing
    ? current.map((e) => (e.columnId === columnId ? { ...e, direction: nextDir } : e))
    : [...preserved, { columnId, direction: nextDir }];
}
