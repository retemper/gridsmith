import type {
  CellRange,
  CellValue,
  ColumnDef,
  FillDirection,
  FillHandlePluginApi,
  FillHandlePluginOptions,
  FillOperation,
  FillPattern,
  FillPatternKind,
  GridPlugin,
} from './types';

// ─── Built-in cyclic lists ─────────────────────────────────

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_NAMES_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTH_NAMES_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// ─── Helpers ───────────────────────────────────────────────

function findInList(list: readonly string[], value: string): number {
  const lower = value.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (list[i].toLowerCase() === lower) return i;
  }
  return -1;
}

/**
 * Return the common difference if the sequence is an arithmetic progression,
 * or `null` otherwise. Float inputs are compared with a relative tolerance so
 * `0.1, 0.2, 0.3` is recognized despite IEEE rounding.
 */
function arithmeticStep(nums: readonly number[]): number | null {
  if (nums.length < 2) return null;
  const step = nums[1] - nums[0];
  const tol = 1e-9 * Math.max(1, Math.abs(step));
  for (let i = 2; i < nums.length; i++) {
    const d = nums[i] - nums[i - 1];
    if (Math.abs(d - step) > tol) return null;
  }
  return step;
}

const MS_PER_DAY = 86_400_000;

function dateToDayNumber(d: Date): number {
  // Round to nearest day so DST shifts don't break the AP check.
  return Math.round(d.getTime() / MS_PER_DAY);
}

function tryListPattern(strs: readonly string[], list: readonly string[]): number[] | null {
  const indices: number[] = [];
  for (const s of strs) {
    const i = findInList(list, s);
    if (i === -1) return null;
    indices.push(i);
  }
  if (arithmeticStep(indices) === null) return null;
  return indices;
}

const PREFIX_NUM_RE = /^(.*?)(-?\d+)$/;

interface PrefixNumParsed {
  prefix: string;
  nums: number[];
}

function tryPrefixNumber(strs: readonly string[]): PrefixNumParsed | null {
  if (strs.length < 2) return null;
  let prefix: string | null = null;
  const nums: number[] = [];
  for (const s of strs) {
    const m = PREFIX_NUM_RE.exec(s);
    if (!m) return null;
    const p = m[1];
    const n = Number(m[2]);
    if (!Number.isFinite(n)) return null;
    if (prefix === null) prefix = p;
    else if (prefix !== p) return null;
    nums.push(n);
  }
  if (arithmeticStep(nums) === null) return null;
  return { prefix: prefix ?? '', nums };
}

const BUILTIN_LIST_CHECKS: ReadonlyArray<{
  list: readonly string[];
  kind: FillPatternKind;
}> = [
  { list: DAY_NAMES_SHORT, kind: 'day-name-short' },
  { list: DAY_NAMES_LONG, kind: 'day-name-long' },
  { list: MONTH_NAMES_SHORT, kind: 'month-name-short' },
  { list: MONTH_NAMES_LONG, kind: 'month-name-long' },
];

// ─── Pattern detection ─────────────────────────────────────

function detectPattern(
  values: readonly CellValue[],
  customLists: readonly (readonly string[])[],
): FillPattern {
  const n = values.length;
  if (n === 0) return { kind: 'copy', values };

  // A single seed can still be extended if it belongs to a known list (Excel
  // treats "Mon" or "Jan" as a sequence even without neighboring cells). For
  // any other type of single value, cycling the copy is the correct default.
  if (n === 1) {
    const only = values[0];
    if (typeof only === 'string') {
      if (findInList(DAY_NAMES_SHORT, only) !== -1) return { kind: 'day-name-short', values };
      if (findInList(DAY_NAMES_LONG, only) !== -1) return { kind: 'day-name-long', values };
      if (findInList(MONTH_NAMES_SHORT, only) !== -1) return { kind: 'month-name-short', values };
      if (findInList(MONTH_NAMES_LONG, only) !== -1) return { kind: 'month-name-long', values };
      for (const list of customLists) {
        if (findInList(list, only) !== -1) return { kind: 'custom-list', values };
      }
    }
    return { kind: 'copy', values };
  }

  // Arithmetic over numbers.
  if (values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    const nums = values as readonly number[];
    const step = arithmeticStep(nums);
    if (step !== null && step !== 0) return { kind: 'arithmetic', values };
    return { kind: 'copy', values };
  }

  // Arithmetic over Date values (day-level).
  if (values.every((v) => v instanceof Date && !Number.isNaN((v as Date).getTime()))) {
    const days = (values as readonly Date[]).map(dateToDayNumber);
    const step = arithmeticStep(days);
    if (step !== null && step !== 0) return { kind: 'date-day', values };
    return { kind: 'copy', values };
  }

  // String-based patterns.
  if (values.every((v) => typeof v === 'string')) {
    const strs = values as readonly string[];

    for (const { list, kind } of BUILTIN_LIST_CHECKS) {
      if (tryListPattern(strs, list)) return { kind, values };
    }
    for (const list of customLists) {
      if (tryListPattern(strs, list)) return { kind: 'custom-list', values };
    }

    if (tryPrefixNumber(strs)) return { kind: 'prefix-number', values };

    return { kind: 'copy', values };
  }

  return { kind: 'copy', values };
}

// ─── Value extrapolation ───────────────────────────────────

function resolveListForKind(
  kind: FillPatternKind,
  values: readonly CellValue[],
  customLists: readonly (readonly string[])[],
): readonly string[] | null {
  switch (kind) {
    case 'day-name-short':
      return DAY_NAMES_SHORT;
    case 'day-name-long':
      return DAY_NAMES_LONG;
    case 'month-name-short':
      return MONTH_NAMES_SHORT;
    case 'month-name-long':
      return MONTH_NAMES_LONG;
    case 'custom-list': {
      // Pick the first registered list that matches the seed — avoids
      // cross-contamination when multiple lists happen to share a value.
      const strs = values as readonly string[];
      for (const list of customLists) {
        if (tryListPattern(strs, list)) return list;
      }
      return null;
    }
    default:
      return null;
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function extrapolate(
  pattern: FillPattern,
  count: number,
  direction: FillDirection,
  customLists: readonly (readonly string[])[],
): CellValue[] {
  if (count <= 0) return [];
  const { kind, values } = pattern;
  const n = values.length;
  if (n === 0) return [];

  if (kind === 'copy') {
    const out: CellValue[] = [];
    for (let i = 0; i < count; i++) {
      const k = direction === 'forward' ? i : -1 - i;
      out.push(values[mod(k, n)]);
    }
    return out;
  }

  if (kind === 'arithmetic') {
    const nums = values as readonly number[];
    const step = (nums[n - 1] - nums[0]) / (n - 1);
    const base = direction === 'forward' ? nums[n - 1] : nums[0];
    const sign = direction === 'forward' ? 1 : -1;
    const out: CellValue[] = [];
    for (let i = 0; i < count; i++) {
      out.push(base + sign * step * (i + 1));
    }
    return out;
  }

  if (kind === 'date-day') {
    const dates = values as readonly Date[];
    const days = dates.map(dateToDayNumber);
    const step = (days[n - 1] - days[0]) / (n - 1);
    const base = direction === 'forward' ? days[n - 1] : days[0];
    const sign = direction === 'forward' ? 1 : -1;
    const out: CellValue[] = [];
    for (let i = 0; i < count; i++) {
      const d = Math.round(base + sign * step * (i + 1));
      out.push(new Date(d * MS_PER_DAY));
    }
    return out;
  }

  if (
    kind === 'day-name-short' ||
    kind === 'day-name-long' ||
    kind === 'month-name-short' ||
    kind === 'month-name-long' ||
    kind === 'custom-list'
  ) {
    const list = resolveListForKind(kind, values, customLists);
    // Degenerate: list lookup lost its match (shouldn't happen in practice —
    // detection and extrapolation use the same registry). Fall back to copy.
    if (!list) return extrapolate({ kind: 'copy', values }, count, direction, customLists);
    const strs = values as readonly string[];
    const indices = strs.map((s) => findInList(list, s));
    const step = n === 1 ? 1 : (indices[n - 1] - indices[0]) / (n - 1);
    const base = direction === 'forward' ? indices[n - 1] : indices[0];
    const sign = direction === 'forward' ? 1 : -1;
    const L = list.length;
    const out: CellValue[] = [];
    for (let i = 0; i < count; i++) {
      const raw = base + sign * step * (i + 1);
      out.push(list[mod(Math.round(raw), L)]);
    }
    return out;
  }

  if (kind === 'prefix-number') {
    const strs = values as readonly string[];
    const parsed = tryPrefixNumber(strs);
    if (!parsed) return extrapolate({ kind: 'copy', values }, count, direction, customLists);
    const { prefix, nums } = parsed;
    const step = (nums[n - 1] - nums[0]) / (n - 1);
    const base = direction === 'forward' ? nums[n - 1] : nums[0];
    const sign = direction === 'forward' ? 1 : -1;
    const out: CellValue[] = [];
    for (let i = 0; i < count; i++) {
      const v = Math.round(base + sign * step * (i + 1));
      out.push(`${prefix}${v}`);
    }
    return out;
  }

  return [];
}

// ─── Range resolution ──────────────────────────────────────

interface ResolvedRect {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  startColId: string;
  endColId: string;
}

function resolveRect(range: CellRange, colIndex: Map<string, number>): ResolvedRect | null {
  const a = colIndex.get(range.startCol);
  const b = colIndex.get(range.endCol);
  if (a === undefined || b === undefined) return null;
  const c0 = Math.min(a, b);
  const c1 = Math.max(a, b);
  const r0 = Math.min(range.startRow, range.endRow);
  const r1 = Math.max(range.startRow, range.endRow);
  return {
    r0,
    r1,
    c0,
    c1,
    startColId: range.startCol,
    endColId: range.endCol,
  };
}

// ─── Plugin ────────────────────────────────────────────────

export function createFillHandlePlugin(options: FillHandlePluginOptions = {}): GridPlugin {
  const customLists: string[][] = (options.customLists ?? []).map((l) => [...l]);

  const plugin: GridPlugin = {
    name: 'fill-handle',

    init(ctx) {
      const columnsOf = (): readonly ColumnDef[] => ctx.grid.columns.get();

      const inferPattern: FillHandlePluginApi['inferPattern'] = (values) =>
        detectPattern(values, customLists);

      const generateValues: FillHandlePluginApi['generateValues'] = (source, count, direction) => {
        const pattern = detectPattern(source, customLists);
        return extrapolate(pattern, count, direction, customLists);
      };

      const fill: FillHandlePluginApi['fill'] = (op: FillOperation) => {
        const cols = columnsOf();
        const colIndex = new Map<string, number>();
        for (let i = 0; i < cols.length; i++) colIndex.set(cols[i].id, i);

        const source = resolveRect(op.source, colIndex);
        const target = resolveRect(op.target, colIndex);
        if (!source || !target) return false;

        // Target must fully contain source; extension happens on exactly one
        // axis. Two-axis drags are ambiguous — Excel rejects them too.
        if (target.r0 > source.r0 || target.r1 < source.r1) return false;
        if (target.c0 > source.c0 || target.c1 < source.c1) return false;

        const extraTop = source.r0 - target.r0;
        const extraBottom = target.r1 - source.r1;
        const extraLeft = source.c0 - target.c0;
        const extraRight = target.c1 - source.c1;
        const rowExt = extraTop + extraBottom;
        const colExt = extraLeft + extraRight;
        if (rowExt === 0 && colExt === 0) return false;
        if (rowExt > 0 && colExt > 0) return false;

        const rowCount = ctx.grid.rowCount;

        ctx.grid.batchUpdate(() => {
          if (rowExt > 0) {
            // Row-axis fill: each source column is an independent seed.
            for (let ci = source.c0; ci <= source.c1; ci++) {
              const col = cols[ci];
              if (!col || col.editable === false) continue;
              const seed: CellValue[] = [];
              for (let r = source.r0; r <= source.r1; r++) {
                seed.push(ctx.grid.getCell(r, col.id));
              }
              if (extraBottom > 0) {
                const vs = generateValues(seed, extraBottom, 'forward');
                for (let i = 0; i < vs.length; i++) {
                  const row = source.r1 + 1 + i;
                  if (row < 0 || row >= rowCount) continue;
                  ctx.grid.setCell(row, col.id, vs[i]);
                }
              }
              if (extraTop > 0) {
                const vs = generateValues(seed, extraTop, 'reverse');
                for (let i = 0; i < vs.length; i++) {
                  const row = source.r0 - 1 - i;
                  if (row < 0 || row >= rowCount) continue;
                  ctx.grid.setCell(row, col.id, vs[i]);
                }
              }
            }
          } else {
            // Column-axis fill: each source row is an independent seed.
            for (let r = source.r0; r <= source.r1; r++) {
              const seed: CellValue[] = [];
              for (let ci = source.c0; ci <= source.c1; ci++) {
                const col = cols[ci];
                seed.push(col ? ctx.grid.getCell(r, col.id) : null);
              }
              if (extraRight > 0) {
                const vs = generateValues(seed, extraRight, 'forward');
                for (let i = 0; i < vs.length; i++) {
                  const col = cols[source.c1 + 1 + i];
                  if (!col || col.editable === false) continue;
                  ctx.grid.setCell(r, col.id, vs[i]);
                }
              }
              if (extraLeft > 0) {
                const vs = generateValues(seed, extraLeft, 'reverse');
                for (let i = 0; i < vs.length; i++) {
                  const col = cols[source.c0 - 1 - i];
                  if (!col || col.editable === false) continue;
                  ctx.grid.setCell(r, col.id, vs[i]);
                }
              }
            }
          }
        });
        return true;
      };

      const api: FillHandlePluginApi = {
        fill,
        inferPattern,
        generateValues,
        registerCustomList(list) {
          customLists.push([...list]);
        },
        getCustomLists() {
          return customLists.map((l) => [...l]);
        },
      };

      ctx.expose('fill-handle', api);

      // No event listeners today — the plugin is driven entirely by caller
      // invocation. Returning a no-op cleanup keeps parity with the other
      // plugins so future additions (e.g. preview decorators) don't leak.
      return () => {
        /* noop */
      };
    },
  };

  return plugin;
}
