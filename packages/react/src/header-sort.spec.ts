import { describe, expect, it } from 'vitest';

import { cycleSortState } from './header-sort';

describe('cycleSortState', () => {
  it('plain click on unsorted column starts asc', () => {
    expect(cycleSortState([], 'a', false)).toEqual([{ columnId: 'a', direction: 'asc' }]);
  });

  it('plain click on ascending column flips to desc', () => {
    expect(cycleSortState([{ columnId: 'a', direction: 'asc' }], 'a', false)).toEqual([
      { columnId: 'a', direction: 'desc' },
    ]);
  });

  it('plain click on descending column clears sort', () => {
    expect(cycleSortState([{ columnId: 'a', direction: 'desc' }], 'a', false)).toEqual([]);
  });

  it('plain click on different column replaces existing sort', () => {
    expect(cycleSortState([{ columnId: 'a', direction: 'asc' }], 'b', false)).toEqual([
      { columnId: 'b', direction: 'asc' },
    ]);
  });

  it('shift-click on unsorted column appends', () => {
    const state = cycleSortState([{ columnId: 'a', direction: 'asc' }], 'b', true);
    expect(state).toEqual([
      { columnId: 'a', direction: 'asc' },
      { columnId: 'b', direction: 'asc' },
    ]);
  });

  it('shift-click on ascending column flips in place (preserves order)', () => {
    const state = cycleSortState(
      [
        { columnId: 'a', direction: 'asc' },
        { columnId: 'b', direction: 'asc' },
      ],
      'a',
      true,
    );
    expect(state).toEqual([
      { columnId: 'a', direction: 'desc' },
      { columnId: 'b', direction: 'asc' },
    ]);
  });

  it('shift-click on descending column removes it without reordering', () => {
    const state = cycleSortState(
      [
        { columnId: 'a', direction: 'asc' },
        { columnId: 'b', direction: 'desc' },
        { columnId: 'c', direction: 'asc' },
      ],
      'b',
      true,
    );
    expect(state).toEqual([
      { columnId: 'a', direction: 'asc' },
      { columnId: 'c', direction: 'asc' },
    ]);
  });
});
