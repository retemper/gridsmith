import type { FillHandlePluginApi, GridInstance } from '@gridsmith/core';
import { useMemo } from 'react';

/**
 * Read the fill-handle plugin API off a grid instance. Returns the same
 * reference across renders for stable callback identities.
 */
export function useGridFillHandle(grid: GridInstance): FillHandlePluginApi | null {
  return useMemo(() => grid.getPlugin<FillHandlePluginApi>('fill-handle') ?? null, [grid]);
}
