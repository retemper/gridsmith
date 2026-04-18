import { createGrid, type GridInstance, type ColumnDef } from '@gridsmith/core';
import { useState, useRef, useEffect, useMemo } from 'react';

import type { GridColumnDef, GridProps } from './types';

export type UseGridOptions = Pick<GridProps, 'data' | 'columns' | 'plugins'>;

function stripReactFields(columns: GridColumnDef[]): ColumnDef[] {
  return columns.map((col): ColumnDef => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cellRenderer, cellEditor, children, ...rest } = col;
    const stripped: ColumnDef = { ...rest };
    if (children && children.length > 0) {
      stripped.children = stripReactFields(children);
    }
    return stripped;
  });
}

/**
 * Create and manage a headless grid instance.
 *
 * - Syncs `data` and `columns` props to the core grid when they change.
 * - SSR safe: `createGrid` is pure and does not access the DOM.
 *
 * Note: The grid instance is created via `useState` and is **not** explicitly
 * destroyed on unmount. This is intentional — `useState` preserves state
 * across React strict-mode's unmount/remount cycle, so an effect-based
 * `grid.destroy()` would break the remounted instance. The grid is a
 * lightweight in-memory object; it will be garbage-collected when the
 * component unmounts and the state reference is released. Subscribers
 * managed by the Grid component clean up via their own effect returns.
 */
export function useGrid(options: UseGridOptions): GridInstance {
  const [grid] = useState(() =>
    createGrid({
      data: options.data,
      columns: stripReactFields(options.columns),
      plugins: options.plugins,
    }),
  );

  // Sync data when reference changes
  const prevDataRef = useRef(options.data);
  useEffect(() => {
    if (options.data === prevDataRef.current) return;
    prevDataRef.current = options.data;
    grid.setData(options.data);
  }, [options.data, grid]);

  // Sync columns when content changes (JSON comparison avoids spurious updates).
  // Memoize the stripped tree by reference so stable `columns` props skip the
  // recursive strip-and-stringify entirely. The replacer serializes functions
  // (e.g. `comparator`) by source so swapping a comparator actually bumps the
  // key instead of silently comparing equal after `JSON.stringify` drops it.
  const coreColumns = useMemo(() => stripReactFields(options.columns), [options.columns]);
  const columnsKey = useMemo(
    () =>
      JSON.stringify(coreColumns, (_key, value) =>
        typeof value === 'function' ? String(value) : value,
      ),
    [coreColumns],
  );
  const prevColumnsKeyRef = useRef(columnsKey);
  useEffect(() => {
    if (columnsKey === prevColumnsKeyRef.current) return;
    prevColumnsKeyRef.current = columnsKey;
    grid.setColumns(coreColumns);
  }, [columnsKey, coreColumns, grid]);

  return grid;
}
