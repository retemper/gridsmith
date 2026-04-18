import { describe, expect, it } from 'vitest';

import { buildHeaderRows, flattenColumns, getHeaderDepth, setLeafWidth } from './column-group';
import type { ColumnDef } from './types';

describe('flattenColumns', () => {
  it('returns the input list when the tree is flat', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A' },
      { id: 'b', header: 'B' },
    ];
    expect(flattenColumns(cols)).toEqual(cols);
  });

  it('extracts leaves from a nested tree in DFS order', () => {
    const cols: ColumnDef[] = [
      { id: 'name', header: 'Name' },
      {
        id: 'address',
        header: 'Address',
        children: [
          { id: 'street', header: 'Street' },
          { id: 'city', header: 'City' },
        ],
      },
      { id: 'age', header: 'Age' },
    ];
    expect(flattenColumns(cols).map((c) => c.id)).toEqual(['name', 'street', 'city', 'age']);
  });

  it('handles deeply nested groups', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g1',
        header: 'G1',
        children: [
          {
            id: 'g2',
            header: 'G2',
            children: [{ id: 'leaf', header: 'Leaf' }],
          },
        ],
      },
    ];
    expect(flattenColumns(cols).map((c) => c.id)).toEqual(['leaf']);
  });

  it('propagates pin from group to its leaves', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g',
        header: 'G',
        pin: 'left',
        children: [
          { id: 'a', header: 'A' },
          { id: 'b', header: 'B' },
        ],
      },
    ];
    const leaves = flattenColumns(cols);
    expect(leaves.every((c) => c.pin === 'left')).toBe(true);
  });

  it('leaf own pin overrides inherited group pin', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g',
        header: 'G',
        pin: 'left',
        children: [
          { id: 'a', header: 'A', pin: 'right' },
          { id: 'b', header: 'B' },
        ],
      },
    ];
    const leaves = flattenColumns(cols);
    expect(leaves.find((c) => c.id === 'a')?.pin).toBe('right');
    expect(leaves.find((c) => c.id === 'b')?.pin).toBe('left');
  });

  it('treats empty children as a leaf', () => {
    const cols: ColumnDef[] = [{ id: 'a', header: 'A', children: [] }];
    expect(flattenColumns(cols).map((c) => c.id)).toEqual(['a']);
  });
});

describe('getHeaderDepth', () => {
  it('returns 1 for a flat list', () => {
    expect(getHeaderDepth([{ id: 'a', header: 'A' }])).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(getHeaderDepth([])).toBe(0);
  });

  it('returns 2 for a single group wrapping leaves', () => {
    expect(
      getHeaderDepth([
        {
          id: 'g',
          header: 'G',
          children: [
            { id: 'a', header: 'A' },
            { id: 'b', header: 'B' },
          ],
        },
      ]),
    ).toBe(2);
  });

  it('returns max depth across siblings', () => {
    const cols: ColumnDef[] = [
      { id: 'flat', header: 'Flat' },
      {
        id: 'g',
        header: 'G',
        children: [
          {
            id: 'gg',
            header: 'GG',
            children: [{ id: 'l', header: 'L' }],
          },
        ],
      },
    ];
    expect(getHeaderDepth(cols)).toBe(3);
  });
});

describe('buildHeaderRows', () => {
  it('builds a single row for flat columns', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A' },
      { id: 'b', header: 'B' },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
    expect(rows[0][0]).toMatchObject({
      isLeaf: true,
      colStart: 0,
      colSpan: 1,
      rowSpan: 1,
    });
    expect(rows[0][1]).toMatchObject({ colStart: 1, colSpan: 1 });
  });

  it('places group in top row and leaves in bottom row', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g',
        header: 'G',
        children: [
          { id: 'a', header: 'A' },
          { id: 'b', header: 'B' },
        ],
      },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({
      isLeaf: false,
      colStart: 0,
      colSpan: 2,
      rowSpan: 1,
    });
    expect(rows[1]).toHaveLength(2);
    expect(rows[1].map((c) => c.column.id)).toEqual(['a', 'b']);
  });

  it('leaves at shallower depth span extra rows via rowSpan', () => {
    const cols: ColumnDef[] = [
      { id: 'flat', header: 'Flat' },
      {
        id: 'g',
        header: 'G',
        children: [{ id: 'inner', header: 'Inner' }],
      },
    ];
    const rows = buildHeaderRows(cols);
    expect(rows).toHaveLength(2);
    const flat = rows[0].find((c) => c.column.id === 'flat');
    expect(flat?.isLeaf).toBe(true);
    expect(flat?.rowSpan).toBe(2);
    const group = rows[0].find((c) => c.column.id === 'g');
    expect(group?.isLeaf).toBe(false);
    expect(group?.rowSpan).toBe(1);
  });

  it('computes colStart as leaf-array offset', () => {
    const cols: ColumnDef[] = [
      { id: 'first', header: 'First' },
      {
        id: 'grp',
        header: 'Grp',
        children: [
          { id: 'x', header: 'X' },
          { id: 'y', header: 'Y' },
        ],
      },
    ];
    const rows = buildHeaderRows(cols);
    const grp = rows[0].find((c) => c.column.id === 'grp');
    expect(grp?.colStart).toBe(1);
    expect(grp?.colSpan).toBe(2);
  });
});

describe('setLeafWidth', () => {
  it('updates width on the matching leaf and returns changed=true', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A', width: 100 },
      { id: 'b', header: 'B', width: 100 },
    ];
    const result = setLeafWidth(cols, 'b', 200);
    expect(result.changed).toBe(true);
    expect(result.columns[1].width).toBe(200);
    expect(result.columns[0].width).toBe(100);
  });

  it('updates a leaf inside a group', () => {
    const cols: ColumnDef[] = [
      {
        id: 'g',
        header: 'G',
        children: [{ id: 'inner', header: 'Inner', width: 80 }],
      },
    ];
    const result = setLeafWidth(cols, 'inner', 120);
    expect(result.changed).toBe(true);
    expect(result.columns[0].children?.[0].width).toBe(120);
  });

  it('returns changed=false when column is not found', () => {
    const cols: ColumnDef[] = [{ id: 'a', header: 'A', width: 100 }];
    const result = setLeafWidth(cols, 'missing', 200);
    expect(result.changed).toBe(false);
  });

  it('returns changed=false when width is unchanged', () => {
    const cols: ColumnDef[] = [{ id: 'a', header: 'A', width: 100 }];
    const result = setLeafWidth(cols, 'a', 100);
    expect(result.changed).toBe(false);
  });
});
