import type { GridInstance, ValidationPluginApi } from '@gridsmith/core';
import { useMemo } from 'react';

/**
 * Read the validation plugin API off a grid instance. Returns the same
 * reference across renders for stable callback identities.
 */
export function useGridValidation(grid: GridInstance): ValidationPluginApi | null {
  return useMemo(() => grid.getPlugin<ValidationPluginApi>('validation') ?? null, [grid]);
}
