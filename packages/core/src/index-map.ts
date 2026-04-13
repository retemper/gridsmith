import type { CellValue, FilterEntry, FilterState, IndexMap, Row, SortState } from './types';

function compareValues(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function matchesFilter(value: CellValue, filter: FilterEntry): boolean {
  const { operator, value: filterValue } = filter;

  if (value == null) {
    return operator === 'eq' && filterValue == null;
  }

  switch (operator) {
    case 'eq':
      return value === filterValue;
    case 'neq':
      return value !== filterValue;
    case 'gt':
      return compareValues(value, filterValue) > 0;
    case 'gte':
      return compareValues(value, filterValue) >= 0;
    case 'lt':
      return compareValues(value, filterValue) < 0;
    case 'lte':
      return compareValues(value, filterValue) <= 0;
    case 'contains':
      return String(value).includes(String(filterValue));
    case 'startsWith':
      return String(value).startsWith(String(filterValue));
    case 'endsWith':
      return String(value).endsWith(String(filterValue));
    default:
      return true;
  }
}

export function buildIndexMap(
  data: Row[],
  sortState: SortState,
  filterState: FilterState,
): IndexMap {
  // 1. Filter: collect indices of rows that pass all filters
  let indices = Array.from({ length: data.length }, (_, i) => i);

  if (filterState.length > 0) {
    indices = indices.filter((dataIndex) => {
      const row = data[dataIndex];
      if (!row) return false;
      return filterState.every((f) => matchesFilter(row[f.columnId], f));
    });
  }

  // 2. Sort
  if (sortState.length > 0) {
    indices.sort((a, b) => {
      const rowA = data[a];
      const rowB = data[b];
      if (!rowA || !rowB) return 0;

      for (const entry of sortState) {
        const cmp = compareValues(rowA[entry.columnId], rowB[entry.columnId]);
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
