import { describe, expect, it } from 'vitest';

import type { ColumnDef } from './types';
import {
  computeColumnLayout,
  calculateVisibleRange,
  getTotalHeight,
  DEFAULT_CONFIG,
} from './virtualization';

// ─── computeColumnLayout ──────────────────────────────────

describe('computeColumnLayout', () => {
  it('uses default width when column width is not set', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A' },
      { id: 'b', header: 'B' },
    ];
    const layout = computeColumnLayout(cols, 100);

    expect(layout.widths).toEqual([100, 100]);
    expect(layout.offsets).toEqual([0, 100]);
    expect(layout.totalWidth).toBe(200);
  });

  it('uses column.width when set', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A', width: 50 },
      { id: 'b', header: 'B', width: 200 },
      { id: 'c', header: 'C', width: 80 },
    ];
    const layout = computeColumnLayout(cols, 100);

    expect(layout.widths).toEqual([50, 200, 80]);
    expect(layout.offsets).toEqual([0, 50, 250]);
    expect(layout.totalWidth).toBe(330);
  });

  it('sets width to 0 for hidden columns', () => {
    const cols: ColumnDef[] = [
      { id: 'a', header: 'A', width: 100 },
      { id: 'b', header: 'B', width: 100, visible: false },
      { id: 'c', header: 'C', width: 100 },
    ];
    const layout = computeColumnLayout(cols, 100);

    expect(layout.widths).toEqual([100, 0, 100]);
    expect(layout.offsets).toEqual([0, 100, 100]);
    expect(layout.totalWidth).toBe(200);
  });

  it('handles empty column list', () => {
    const layout = computeColumnLayout([], 100);

    expect(layout.widths).toEqual([]);
    expect(layout.offsets).toEqual([]);
    expect(layout.totalWidth).toBe(0);
  });
});

// ─── calculateVisibleRange ────────────────────────────────

describe('calculateVisibleRange', () => {
  const cols: ColumnDef[] = [
    { id: 'a', header: 'A', width: 100 },
    { id: 'b', header: 'B', width: 100 },
    { id: 'c', header: 'C', width: 100 },
    { id: 'd', header: 'D', width: 100 },
    { id: 'e', header: 'E', width: 100 },
  ];
  const layout = computeColumnLayout(cols, 100);
  const config = { ...DEFAULT_CONFIG, overscan: 1 };

  it('computes visible rows at scroll top 0', () => {
    const range = calculateVisibleRange(0, 0, 300, 100, 1000, layout, config);

    // viewport 100px / rowHeight 32 = ceil(3.125) = 4 visible rows
    // with overscan 1: rowStart = max(0, 0-1) = 0, rowEnd = min(999, 0+4+1) = 5
    expect(range.rowStart).toBe(0);
    expect(range.rowEnd).toBe(5);
  });

  it('computes visible rows when scrolled down', () => {
    const range = calculateVisibleRange(320, 0, 300, 100, 1000, layout, config);

    // scrollTop 320 / 32 = row 10
    // rowStart = max(0, 10-1) = 9
    // rowEnd = min(999, 10+4+1) = 15
    expect(range.rowStart).toBe(9);
    expect(range.rowEnd).toBe(15);
  });

  it('clamps rowEnd to totalRows - 1', () => {
    const range = calculateVisibleRange(0, 0, 300, 500, 5, layout, config);

    expect(range.rowStart).toBe(0);
    expect(range.rowEnd).toBe(4); // max index for 5 rows
  });

  it('computes visible columns at scroll left 0', () => {
    const range = calculateVisibleRange(0, 0, 250, 100, 100, layout, config);

    // viewport 250px shows columns 0,1,2 (300px total)
    // with overscan 1: colStart = 0, colEnd = min(4, 2+1) = 3
    expect(range.colStart).toBe(0);
    expect(range.colEnd).toBe(3);
  });

  it('computes visible columns when scrolled right', () => {
    const range = calculateVisibleRange(0, 200, 150, 100, 100, layout, config);

    // scrollLeft 200 → column 2 starts at 200
    // viewport 150px shows columns 2,3 (200-350)
    // overscan 1: colStart = max(0, 2-1) = 1, colEnd = min(4, 3+1) = 4
    expect(range.colStart).toBe(1);
    expect(range.colEnd).toBe(4);
  });

  it('handles 1M rows efficiently', () => {
    const totalRows = 1_000_000;
    const start = performance.now();
    const range = calculateVisibleRange(500_000 * 32, 0, 500, 600, totalRows, layout, config);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5); // O(1) for rows
    expect(range.rowStart).toBe(500_000 - config.overscan);
    expect(range.rowEnd).toBeLessThan(totalRows);
  });

  it('handles many columns with binary search', () => {
    const manyCols: ColumnDef[] = Array.from({ length: 200 }, (_, i) => ({
      id: `col${i}`,
      header: `Col ${i}`,
      width: 80,
    }));
    const manyLayout = computeColumnLayout(manyCols, 80);

    const range = calculateVisibleRange(0, 8000, 800, 600, 100, manyLayout, config);

    // scrollLeft 8000 / 80 = column 100
    expect(range.colStart).toBeGreaterThanOrEqual(99);
    expect(range.colEnd).toBeLessThanOrEqual(111);
  });

  it('returns empty range when totalRows is 0', () => {
    const range = calculateVisibleRange(0, 0, 300, 100, 0, layout, config);

    expect(range.rowStart).toBe(0);
    expect(range.rowEnd).toBe(-1);
    expect(range.colStart).toBe(0);
    expect(range.colEnd).toBe(-1);
  });

  it('returns empty range when columns are empty', () => {
    const emptyLayout = computeColumnLayout([], 100);
    const range = calculateVisibleRange(0, 0, 300, 100, 100, emptyLayout, config);

    expect(range.rowStart).toBe(0);
    expect(range.rowEnd).toBe(-1);
  });

  it('skips hidden columns at boundaries', () => {
    const colsWithHidden: ColumnDef[] = [
      { id: 'a', header: 'A', width: 100, visible: false },
      { id: 'b', header: 'B', width: 100 },
      { id: 'c', header: 'C', width: 100 },
    ];
    const hiddenLayout = computeColumnLayout(colsWithHidden, 100);
    const range = calculateVisibleRange(0, 0, 200, 100, 10, hiddenLayout, {
      ...DEFAULT_CONFIG,
      overscan: 0,
    });

    expect(range.colStart).toBe(1); // skip hidden col 0
  });
});

// ─── getTotalHeight ───────────────────────────────────────

describe('getTotalHeight', () => {
  it('returns rows * rowHeight', () => {
    expect(getTotalHeight(100, 32)).toBe(3200);
    expect(getTotalHeight(1_000_000, 32)).toBe(32_000_000);
  });

  it('returns 0 for empty grid', () => {
    expect(getTotalHeight(0, 32)).toBe(0);
  });
});
