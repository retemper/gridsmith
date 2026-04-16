import { describe, expect, it } from 'vitest';

import { buildIndexMap } from './index-map';
import type { ColumnDef, Row } from './types';

const data: Row[] = [
  { name: 'Alice', age: 30, city: 'Seoul' },
  { name: 'Bob', age: 25, city: 'Tokyo' },
  { name: 'Charlie', age: 35, city: 'Seoul' },
];

describe('buildIndexMap', () => {
  it('returns identity map with no sort/filter', () => {
    const map = buildIndexMap(data, [], []);
    expect(map.length).toBe(3);
    expect(map.viewToData(0)).toBe(0);
    expect(map.viewToData(1)).toBe(1);
    expect(map.viewToData(2)).toBe(2);
  });

  it('handles empty data', () => {
    const map = buildIndexMap([], [], []);
    expect(map.length).toBe(0);
  });

  it('throws RangeError for out-of-bounds viewToData', () => {
    const map = buildIndexMap(data, [], []);
    expect(() => map.viewToData(-1)).toThrow(RangeError);
    expect(() => map.viewToData(3)).toThrow(RangeError);
  });

  it('throws RangeError on empty data viewToData', () => {
    const map = buildIndexMap([], [], []);
    expect(() => map.viewToData(0)).toThrow(RangeError);
  });

  it('returns null for non-existent dataToView', () => {
    const map = buildIndexMap(data, [], []);
    expect(map.dataToView(999)).toBeNull();
  });

  describe('sort', () => {
    it('sorts ascending', () => {
      const map = buildIndexMap(data, [{ columnId: 'age', direction: 'asc' }], []);
      expect(map.viewToData(0)).toBe(1); // Bob 25
      expect(map.viewToData(1)).toBe(0); // Alice 30
      expect(map.viewToData(2)).toBe(2); // Charlie 35
    });

    it('sorts descending', () => {
      const map = buildIndexMap(data, [{ columnId: 'age', direction: 'desc' }], []);
      expect(map.viewToData(0)).toBe(2); // Charlie 35
      expect(map.viewToData(2)).toBe(1); // Bob 25
    });

    it('handles null values in sort (nulls first)', () => {
      const withNulls: Row[] = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: null },
        { name: 'Charlie', age: 25 },
      ];
      const map = buildIndexMap(withNulls, [{ columnId: 'age', direction: 'asc' }], []);
      expect(map.viewToData(0)).toBe(1); // Bob null (first)
      expect(map.viewToData(1)).toBe(2); // Charlie 25
      expect(map.viewToData(2)).toBe(0); // Alice 30
    });

    it('multi-column sort', () => {
      const tied: Row[] = [
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: 30 },
        { name: 'Charlie', age: 25 },
      ];
      const map = buildIndexMap(
        tied,
        [
          { columnId: 'age', direction: 'asc' },
          { columnId: 'name', direction: 'asc' },
        ],
        [],
      );
      expect(map.viewToData(0)).toBe(2); // Charlie 25
      expect(map.viewToData(1)).toBe(1); // Alice 30
      expect(map.viewToData(2)).toBe(0); // Bob 30
    });
  });

  describe('filter', () => {
    it('filters by equality', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);
      expect(map.length).toBe(2);
      expect(map.viewToData(0)).toBe(0); // Alice
      expect(map.viewToData(1)).toBe(2); // Charlie
    });

    it('filters by neq', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'city', operator: 'neq', value: 'Seoul' }]);
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(1); // Bob
    });

    it('filters by contains', () => {
      const map = buildIndexMap(
        data,
        [],
        [{ columnId: 'name', operator: 'contains', value: 'li' }],
      );
      expect(map.length).toBe(2); // Alice, Charlie
    });

    it('filters by startsWith', () => {
      const map = buildIndexMap(
        data,
        [],
        [{ columnId: 'name', operator: 'startsWith', value: 'A' }],
      );
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(0); // Alice
    });

    it('filters by endsWith', () => {
      const map = buildIndexMap(
        data,
        [],
        [{ columnId: 'name', operator: 'endsWith', value: 'ob' }],
      );
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(1); // Bob
    });

    it('filters by gt/gte/lt/lte', () => {
      const gtMap = buildIndexMap(data, [], [{ columnId: 'age', operator: 'gt', value: 25 }]);
      expect(gtMap.length).toBe(2); // Alice 30, Charlie 35

      const gteMap = buildIndexMap(data, [], [{ columnId: 'age', operator: 'gte', value: 30 }]);
      expect(gteMap.length).toBe(2); // Alice 30, Charlie 35

      const ltMap = buildIndexMap(data, [], [{ columnId: 'age', operator: 'lt', value: 35 }]);
      expect(ltMap.length).toBe(2); // Alice 30, Bob 25

      const lteMap = buildIndexMap(data, [], [{ columnId: 'age', operator: 'lte', value: 25 }]);
      expect(lteMap.length).toBe(1); // Bob 25
    });

    it('handles null value in eq filter', () => {
      const withNulls: Row[] = [
        { name: 'Alice', city: null },
        { name: 'Bob', city: 'Seoul' },
      ];
      const map = buildIndexMap(withNulls, [], [{ columnId: 'city', operator: 'eq', value: null }]);
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(0);
    });

    it('multiple filters (AND logic)', () => {
      const map = buildIndexMap(
        data,
        [],
        [
          { columnId: 'city', operator: 'eq', value: 'Seoul' },
          { columnId: 'age', operator: 'gt', value: 30 },
        ],
      );
      expect(map.length).toBe(1); // Charlie only
      expect(map.viewToData(0)).toBe(2);
    });

    it('filter that excludes all rows', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'city', operator: 'eq', value: 'Nowhere' }]);
      expect(map.length).toBe(0);
    });
  });

  describe('sort + filter combined', () => {
    it('filters then sorts', () => {
      const map = buildIndexMap(
        data,
        [{ columnId: 'age', direction: 'desc' }],
        [{ columnId: 'city', operator: 'eq', value: 'Seoul' }],
      );
      expect(map.length).toBe(2);
      expect(map.viewToData(0)).toBe(2); // Charlie 35
      expect(map.viewToData(1)).toBe(0); // Alice 30
    });
  });

  describe('filter: extended operators', () => {
    it('filters by regex (string pattern)', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'name', operator: 'regex', value: '^A' }]);
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(0); // Alice
    });

    it('filters by regex (RegExp instance)', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'name', operator: 'regex', value: /li/i }]);
      expect(map.length).toBe(2); // Alice, Charlie
    });

    it('invalid regex pattern matches nothing without throwing', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'name', operator: 'regex', value: '[' }]);
      expect(map.length).toBe(0);
    });

    it('filters numbers by between (inclusive)', () => {
      const map = buildIndexMap(
        data,
        [],
        [{ columnId: 'age', operator: 'between', value: [26, 35] }],
      );
      expect(map.length).toBe(2); // Alice 30, Charlie 35
    });

    it('between with invalid range (missing bound) matches nothing', () => {
      const map = buildIndexMap(
        data,
        [],
        [{ columnId: 'age', operator: 'between', value: [null, 35] }],
      );
      expect(map.length).toBe(0);
    });

    it('filters dates by before/after (lt/gt) and between', () => {
      const dated: Row[] = [
        { id: 1, when: new Date('2024-01-10') },
        { id: 2, when: new Date('2024-02-15') },
        { id: 3, when: new Date('2024-03-20') },
      ];
      const before = buildIndexMap(
        dated,
        [],
        [{ columnId: 'when', operator: 'lt', value: new Date('2024-02-01') }],
      );
      expect(before.length).toBe(1); // Jan 10

      const after = buildIndexMap(
        dated,
        [],
        [{ columnId: 'when', operator: 'gt', value: new Date('2024-02-01') }],
      );
      expect(after.length).toBe(2); // Feb 15, Mar 20

      const range = buildIndexMap(
        dated,
        [],
        [
          {
            columnId: 'when',
            operator: 'between',
            value: [new Date('2024-02-01'), new Date('2024-03-01')],
          },
        ],
      );
      expect(range.length).toBe(1); // Feb 15 only
    });

    it('filters by in / notIn (select includes/excludes)', () => {
      const inMap = buildIndexMap(
        data,
        [],
        [{ columnId: 'city', operator: 'in', value: ['Seoul', 'Paris'] }],
      );
      expect(inMap.length).toBe(2); // Alice, Charlie

      const notInMap = buildIndexMap(
        data,
        [],
        [{ columnId: 'city', operator: 'notIn', value: ['Seoul'] }],
      );
      expect(notInMap.length).toBe(1);
      expect(notInMap.viewToData(0)).toBe(1); // Bob
    });

    it('in matches null when candidates include null', () => {
      const withNulls: Row[] = [
        { name: 'Alice', city: null },
        { name: 'Bob', city: 'Seoul' },
      ];
      const map = buildIndexMap(
        withNulls,
        [],
        [{ columnId: 'city', operator: 'in', value: [null, 'Paris'] }],
      );
      expect(map.length).toBe(1);
      expect(map.viewToData(0)).toBe(0);
    });
  });

  describe('sort: custom comparators', () => {
    const rows: Row[] = [
      { id: 1, label: 'b2' },
      { id: 2, label: 'a10' },
      { id: 3, label: 'a2' },
    ];

    it('uses column-level comparator when provided', () => {
      // Natural / numeric-aware comparator so "a2" sorts before "a10".
      const natural = (a: unknown, b: unknown) =>
        String(a).localeCompare(String(b), undefined, { numeric: true });

      const columns: ColumnDef[] = [
        { id: 'id', header: 'ID' },
        { id: 'label', header: 'Label', comparator: natural },
      ];
      const map = buildIndexMap(rows, [{ columnId: 'label', direction: 'asc' }], [], columns);
      expect(map.viewToData(0)).toBe(2); // a2
      expect(map.viewToData(1)).toBe(1); // a10
      expect(map.viewToData(2)).toBe(0); // b2
    });

    it('entry-level comparator overrides column-level', () => {
      const alpha = (a: unknown, b: unknown) => String(a).localeCompare(String(b));
      // Column comparator reverses; entry comparator restores natural ascending.
      const columns: ColumnDef[] = [
        { id: 'label', header: 'L', comparator: (a, b) => -alpha(a, b) },
      ];
      const map = buildIndexMap(
        rows,
        [{ columnId: 'label', direction: 'asc', comparator: alpha }],
        [],
        columns,
      );
      // With plain alphabetical comparator, "a10" < "a2" < "b2"
      expect(map.viewToData(0)).toBe(1); // a10
      expect(map.viewToData(1)).toBe(2); // a2
      expect(map.viewToData(2)).toBe(0); // b2
    });
  });

  describe('dataToView', () => {
    it('reverse maps correctly', () => {
      const map = buildIndexMap(data, [{ columnId: 'age', direction: 'asc' }], []);
      expect(map.dataToView(0)).toBe(1); // Alice is at view index 1
      expect(map.dataToView(1)).toBe(0); // Bob is at view index 0
      expect(map.dataToView(2)).toBe(2); // Charlie is at view index 2
    });

    it('returns null for filtered-out rows', () => {
      const map = buildIndexMap(data, [], [{ columnId: 'city', operator: 'eq', value: 'Seoul' }]);
      expect(map.dataToView(1)).toBeNull(); // Bob is filtered out
    });
  });
});
