import type { ColumnDef, PinPosition } from './types';

// ─── Header Cell ──────────────────────────────────────────

/**
 * A single cell in a multi-row column header. Header rendering consumes a
 * `HeaderCell[][]` where the outer array is rows (row 0 is the top-most row).
 *
 * - Group cells span multiple leaf columns horizontally (`colSpan > 1`) and
 *   sit in a single row (`rowSpan === 1`).
 * - Leaf cells sit in the bottom row and span all remaining rows below their
 *   starting row (`rowSpan >= 1`, `colSpan === 1`).
 */
export interface HeaderCell {
  /** Source column def (either a group or a leaf). */
  column: ColumnDef;
  /** `true` when `column.children` is absent or empty. */
  isLeaf: boolean;
  /** Zero-based start index into the flat leaf-column array. */
  colStart: number;
  /** Number of leaf columns spanned. */
  colSpan: number;
  /** Number of header rows spanned. */
  rowSpan: number;
}

// ─── Flattening ───────────────────────────────────────────

/** Minimal shape `flattenColumns` requires. Accepts `ColumnDef`, `GridColumnDef`, or any extension. */
type ColumnTreeNode<T extends ColumnTreeNode<T>> = {
  id: string;
  pin?: PinPosition;
  children?: T[];
};

/**
 * Walks the column tree and returns the ordered list of leaf columns.
 *
 * Leaves inherit `pin` from their closest pinned ancestor. A child's own
 * `pin` (if set) wins over inherited state.
 *
 * Generic over the column shape so framework adapters (e.g. `GridColumnDef`
 * with `cellRenderer`) can use the same implementation.
 */
export function flattenColumns<T extends ColumnTreeNode<T>>(columns: readonly T[]): T[] {
  const out: T[] = [];
  walkLeaves(columns, undefined, out);
  return out;
}

function walkLeaves<T extends ColumnTreeNode<T>>(
  columns: readonly T[],
  inheritedPin: PinPosition | undefined,
  out: T[],
): void {
  for (const col of columns) {
    const effectivePin = col.pin ?? inheritedPin;
    if (col.children && col.children.length > 0) {
      walkLeaves(col.children, effectivePin, out);
    } else {
      if (effectivePin !== undefined && effectivePin !== col.pin) {
        out.push({ ...col, pin: effectivePin });
      } else {
        out.push(col);
      }
    }
  }
}

// ─── Depth ────────────────────────────────────────────────

/**
 * Maximum nesting depth of the column tree. A flat list returns 1. A single
 * group wrapping flat leaves returns 2, and so on.
 */
export function getHeaderDepth(columns: readonly ColumnDef[]): number {
  let max = 0;
  for (const col of columns) {
    const d = col.children && col.children.length > 0 ? 1 + getHeaderDepth(col.children) : 1;
    if (d > max) max = d;
  }
  return max;
}

// ─── Header Rows ──────────────────────────────────────────

/**
 * Build the 2D header-cell grid for rendering. Each row in the returned array
 * is a header row (top→bottom). Leaf columns appear in the bottom row unless
 * their ancestor depth is shallower than the tree's overall depth, in which
 * case they extend upward via `rowSpan`.
 */
export function buildHeaderRows(columns: readonly ColumnDef[]): HeaderCell[][] {
  const depth = getHeaderDepth(columns);
  const rows: HeaderCell[][] = Array.from({ length: depth }, () => []);

  let cursor = 0;

  function visit(col: ColumnDef, rowStart: number): number {
    if (col.children && col.children.length > 0) {
      const start = cursor;
      for (const child of col.children) visit(child, rowStart + 1);
      const span = cursor - start;
      rows[rowStart].push({
        column: col,
        isLeaf: false,
        colStart: start,
        colSpan: span,
        rowSpan: 1,
      });
      return span;
    }

    const start = cursor;
    cursor++;
    rows[rowStart].push({
      column: col,
      isLeaf: true,
      colStart: start,
      colSpan: 1,
      rowSpan: Math.max(1, depth - rowStart),
    });
    return 1;
  }

  for (const col of columns) {
    visit(col, 0);
  }

  return rows;
}

// ─── Structure Key ────────────────────────────────────────

/**
 * Compact string describing the shape of a column tree: leaf ids and group
 * nesting, with no width/visibility/pin data. Two trees produce the same key
 * iff their header layout (depth + spans) is identical, so it's safe to use
 * as a memo dependency for `buildHeaderRows` / `getHeaderDepth` — resizing a
 * leaf mutates the tree reference without changing the key.
 */
export function columnStructureKey(columns: readonly ColumnDef[]): string {
  const parts: string[] = [];
  for (const c of columns) {
    if (c.children && c.children.length > 0) {
      parts.push(`${c.id}[${columnStructureKey(c.children)}]`);
    } else {
      parts.push(c.id);
    }
  }
  return parts.join(',');
}

// ─── Tree Mutation ────────────────────────────────────────

/**
 * Return a new tree with the width of the leaf matching `columnId` replaced by
 * `width`. Non-leaf groups carry no width. The tree is shallow-copied along
 * the path to the modified leaf; untouched branches share references with the
 * original tree.
 */
export function setLeafWidth(
  columns: readonly ColumnDef[],
  columnId: string,
  width: number,
): { columns: ColumnDef[]; changed: boolean } {
  let changed = false;
  const next = columns.map((col): ColumnDef => {
    if (col.children && col.children.length > 0) {
      const result = setLeafWidth(col.children, columnId, width);
      if (result.changed) {
        changed = true;
        return { ...col, children: result.columns };
      }
      return col;
    }
    if (col.id === columnId && col.width !== width) {
      changed = true;
      return { ...col, width };
    }
    return col;
  });
  return { columns: changed ? next : (columns as ColumnDef[]), changed };
}
