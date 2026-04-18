import type { ClipboardPluginApi, GridInstance } from '@gridsmith/core';
import { useMemo } from 'react';

/**
 * Read the clipboard plugin API off a grid instance. Returns the same
 * reference across renders for stable callback identities.
 */
export function useGridClipboard(grid: GridInstance): ClipboardPluginApi | null {
  return useMemo(() => grid.getPlugin<ClipboardPluginApi>('clipboard') ?? null, [grid]);
}
