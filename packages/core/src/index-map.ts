import { PLACEHOLDER_ROW } from './row-meta';
import type {
  CellComparator,
  CellValue,
  ColumnDef,
  FilterEntry,
  FilterState,
  IndexMap,
  Row,
  SortState,
} from './types';

function defaultCompare(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  // Dates: compare by timestamp to avoid falling through to lexicographic
  // comparison of `toString()` output (which is locale-dependent for Date).
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function asArray(v: unknown): readonly CellValue[] {
  return Array.isArray(v) ? (v as readonly CellValue[]) : [];
}

/**
 * Per-row predicate evaluation. `regex` callers must pre-compile the pattern
 * and pass it via `compiledRegex` — compiling inside this function runs once
 * per row per filter, which is unacceptable at 1M-row scale.
 */
function matchesFilter(
  value: CellValue,
  filter: FilterEntry,
  compiledRegex: RegExp | null,
): boolean {
  const { operator, value: filterValue } = filter;

  // `eq` against null and `in`/`notIn` semantics need to handle null values
  // explicitly; other operators short-circuit to "no match" when the cell is
  // null to avoid surprising coercions.
  if (value == null) {
    switch (operator) {
      case 'eq':
        return filterValue == null;
      case 'neq':
        return filterValue != null;
      case 'in':
        return asArray(filterValue).some((v) => v == null);
      case 'notIn':
        return !asArray(filterValue).some((v) => v == null);
      default:
        return false;
    }
  }

  switch (operator) {
    case 'eq':
      return value === filterValue;
    case 'neq':
      return value !== filterValue;
    case 'gt':
      return defaultCompare(value, filterValue as CellValue) > 0;
    case 'gte':
      return defaultCompare(value, filterValue as CellValue) >= 0;
    case 'lt':
      return defaultCompare(value, filterValue as CellValue) < 0;
    case 'lte':
      return defaultCompare(value, filterValue as CellValue) <= 0;
    case 'between': {
      const range = asArray(filterValue);
      if (range.length < 2) return false;
      const [min, max] = range as [CellValue, CellValue];
      if (min == null || max == null) return false;
      return defaultCompare(value, min) >= 0 && defaultCompare(value, max) <= 0;
    }
    case 'contains':
      return String(value).includes(String(filterValue));
    case 'startsWith':
      return String(value).startsWith(String(filterValue));
    case 'endsWith':
      return String(value).endsWith(String(filterValue));
    case 'regex':
      // Invalid or missing pattern ⇒ no matches. Never throws — filter state
      // should not be able to crash the grid.
      return compiledRegex != null && compiledRegex.test(String(value));
    case 'in':
      return asArray(filterValue).some((v) => v === value);
    case 'notIn':
      return !asArray(filterValue).some((v) => v === value);
    default:
      return true;
  }
}

function compileRegex(value: FilterEntry['value']): RegExp | null {
  if (value instanceof RegExp) return value;
  if (typeof value !== 'string') return null;
  try {
    return new RegExp(value);
  } catch {
    return null;
  }
}

export function buildIndexMap(
  data: Row[],
  sortState: SortState,
  filterState: FilterState,
  columns?: readonly ColumnDef[],
): IndexMap {
  // 1. Filter: collect indices of rows that pass all filters
  let indices = Array.from({ length: data.length }, (_, i) => i);

  if (filterState.length > 0) {
    // Pre-compile regex patterns once. `matchesFilter` runs O(rows × filters),
    // so recompiling per row turns the 1M-row benchmark into a cliff.
    const compiledRegex: (RegExp | null)[] = filterState.map((f) =>
      f.operator === 'regex' ? compileRegex(f.value) : null,
    );
    indices = indices.filter((dataIndex) => {
      const row = data[dataIndex];
      if (!row) return false;
      // Async placeholders carry no real values yet; applying a predicate
      // against undefined would hide every not-yet-loaded row and collapse
      // the view during a refetch. Pass them through — once the real row
      // arrives, the plugin bumps `dataVersion` and the filter re-runs.
      if ((row as Row & { [PLACEHOLDER_ROW]?: true })[PLACEHOLDER_ROW]) return true;
      return filterState.every((f, i) => matchesFilter(row[f.columnId], f, compiledRegex[i]));
    });
  }

  // 2. Sort — resolve per-column comparators once, then apply in order.
  if (sortState.length > 0) {
    const comparators: CellComparator[] = sortState.map((entry) => {
      if (entry.comparator) return entry.comparator;
      const col = columns?.find((c) => c.id === entry.columnId);
      return col?.comparator ?? defaultCompare;
    });

    indices.sort((a, b) => {
      const rowA = data[a];
      const rowB = data[b];
      if (!rowA || !rowB) return 0;

      for (let i = 0; i < sortState.length; i++) {
        const entry = sortState[i];
        const cmp = comparators[i](rowA[entry.columnId], rowB[entry.columnId]);
        if (cmp !== 0) {
          return entry.direction === 'desc' ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  // 3. Build reverse map (dataIndex → viewIndex)
  const dataToViewMap = new Map<number, number>();
  for (let viewIdx = 0; viewIdx < indices.length; viewIdx++) {
    const dataIdx = indices[viewIdx];
    if (dataIdx !== undefined) {
      dataToViewMap.set(dataIdx, viewIdx);
    }
  }

  return {
    viewToData(viewIndex: number): number {
      if (viewIndex < 0 || viewIndex >= indices.length) {
        throw new RangeError(`View index ${viewIndex} out of range [0, ${indices.length})`);
      }
      // Safe: bounds checked above
      return indices[viewIndex] as number;
    },
    dataToView(dataIndex: number): number | null {
      return dataToViewMap.get(dataIndex) ?? null;
    },
    get length() {
      return indices.length;
    },
  };
}
