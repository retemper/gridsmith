import type { GridInstance } from '@gridsmith/core';
import { createAnnouncer } from '@gridsmith/core';
import { useEffect, type RefObject } from 'react';

/**
 * Wires a grid instance to two aria-live regions: a polite one for sort /
 * filter / paste summaries and an assertive one for validation errors. Both
 * refs should point to visually hidden containers rendered by the caller.
 */
export function useGridAnnouncements(
  grid: GridInstance,
  politeRef: RefObject<HTMLElement | null>,
  assertiveRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const politeEl = politeRef.current;
    const assertiveEl = assertiveRef.current;
    if (!politeEl || !assertiveEl) return;

    const polite = createAnnouncer(politeEl);
    const assertive = createAnnouncer(assertiveEl);

    // Key-based diff catches the clear-and-add-in-same-tick case that a
    // simple count comparison would miss.
    let prevErrorKeys = new Set<string>();

    const unsubs = [
      grid.subscribe('sort:change', ({ sort }) => {
        if (sort.length === 0) {
          polite.announce('Sort cleared');
          return;
        }
        const columns = grid.columns.get();
        const parts = sort.map((entry) => {
          const col = columns.find((c) => c.id === entry.columnId);
          const label = col?.header ?? entry.columnId;
          return `${label} ${entry.direction === 'asc' ? 'ascending' : 'descending'}`;
        });
        polite.announce(`Sorted by ${parts.join(', ')}`);
      }),
      grid.subscribe('filter:change', () => {
        polite.announce(`Showing ${grid.rowCount} rows`);
      }),
      grid.subscribe('clipboard:paste', ({ rows, cols }) => {
        polite.announce(
          `Pasted ${rows} ${rows === 1 ? 'row' : 'rows'} by ${cols} ${cols === 1 ? 'column' : 'columns'}`,
        );
      }),
      grid.subscribe('validation:change', ({ errors }) => {
        const nonPending = errors.filter((e) => e.state !== 'pending');
        const currentKeys = new Set(nonPending.map((e) => `${e.dataIndex}:${e.columnId}`));
        const newlyAdded = nonPending.find(
          (e) => !prevErrorKeys.has(`${e.dataIndex}:${e.columnId}`),
        );
        if (newlyAdded) assertive.announce(`Invalid: ${newlyAdded.message}`);
        prevErrorKeys = currentKeys;
      }),
    ];

    return () => {
      for (const u of unsubs) u();
      polite.destroy();
      assertive.destroy();
    };
  }, [grid, politeRef, assertiveRef]);
}
