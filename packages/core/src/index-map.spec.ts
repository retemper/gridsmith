import { describe, expect, it } from 'vitest';

import { buildIndexMap } from './index-map';
import type { Row } from './types';

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
