import type {
  CellCoord,
  CellRange,
  ColumnDef,
  GridPlugin,
  SelectionPluginApi,
  SelectionState,
} from './types';

interface InternalRange extends CellRange {
  /** The anchor corner from which this range was originally drawn. */
  anchorRow: number;
  anchorCol: string;
}

function toPublic(r: InternalRange): CellRange {
  return {
    startRow: r.startRow,
    endRow: r.endRow,
    startCol: r.startCol,
    endCol: r.endCol,
  };
}

function buildColIndex(columns: readonly ColumnDef[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) m.set(columns[i].id, i);
  return m;
}

function rectFrom(
  anchorRow: number,
  anchorCol: string,
  headRow: number,
  headCol: string,
  colIndex: Map<string, number>,
): InternalRange {
  const a = colIndex.get(anchorCol);
  const b = colIndex.get(headCol);
  // If either id resolves to undefined (stale after a column change), keep the
  // original ids — the range will be self-consistent on its endpoints.
  const swap = a !== undefined && b !== undefined && a > b;
  return {
    startRow: Math.min(anchorRow, headRow),
    endRow: Math.max(anchorRow, headRow),
    startCol: swap ? headCol : anchorCol,
    endCol: swap ? anchorCol : headCol,
    anchorRow,
    anchorCol,
  };
}

function rangeContains(
  range: InternalRange,
  rowIndex: number,
  columnId: string,
  colIndex: Map<string, number>,
): boolean {
  if (rowIndex < range.startRow || rowIndex > range.endRow) return false;
  if (columnId === range.startCol || columnId === range.endCol) return true;
  const target = colIndex.get(columnId);
  const a = colIndex.get(range.startCol);
  const b = colIndex.get(range.endCol);
  if (target === undefined || a === undefined || b === undefined) return false;
  return target >= Math.min(a, b) && target <= Math.max(a, b);
}

export function createSelectionPlugin(): GridPlugin {
  let ranges: InternalRange[] = [];
  let activeCell: CellCoord | null = null;

  const plugin: GridPlugin = {
    name: 'selection',

    init(ctx) {
      // Cache columnId → index across calls; rebuild on columns:update so
      // hot-path selection lookups stay O(1) per cell instead of O(C).
      let cachedCols: readonly ColumnDef[] | null = null;
      let cachedIndex: Map<string, number> = new Map();
      const colIndexOf = (): Map<string, number> => {
        const cols = ctx.grid.columns.get();
        if (cols !== cachedCols) {
          cachedCols = cols;
          cachedIndex = buildColIndex(cols);
        }
        return cachedIndex;
      };
      const columnsOf = () => ctx.grid.columns.get();

      // Snapshot is cached so `getState()` returns the same reference until
      // selection actually changes — required for `useSyncExternalStore` to
      // avoid spurious re-renders / "getSnapshot should be cached" warnings.
      let cachedSnapshot: SelectionState | null = null;
      const buildSnapshot = (): SelectionState => ({
        ranges: ranges.map(toPublic),
        activeCell: activeCell ? { ...activeCell } : null,
      });
      const getSnapshot = (): SelectionState => {
        if (!cachedSnapshot) cachedSnapshot = buildSnapshot();
        return cachedSnapshot;
      };

      const publish = () => {
        cachedSnapshot = null;
        ctx.events.emit('selection:change', getSnapshot());
      };

      const clearInternal = () => {
        if (ranges.length === 0 && activeCell === null) return;
        ranges = [];
        activeCell = null;
      };

      const resolveAnchor = (): { row: number; col: string } | null => {
        const last = ranges[ranges.length - 1];
        if (last) return { row: last.anchorRow, col: last.anchorCol };
        if (activeCell) return { row: activeCell.row, col: activeCell.col };
        return null;
      };

      const api: SelectionPluginApi = {
        getState() {
          return getSnapshot();
        },

        selectCell(coord) {
          ranges = [rectFrom(coord.row, coord.col, coord.row, coord.col, colIndexOf())];
          activeCell = { ...coord };
          publish();
        },

        addCell(coord) {
          // Excel parity: Ctrl/Cmd+click on an already-isolated single-cell
          // range removes that range (toggle off). Multi-cell ranges are
          // never auto-toggled — that gesture would be ambiguous.
          const dupIdx = ranges.findIndex(
            (r) =>
              r.startRow === coord.row &&
              r.endRow === coord.row &&
              r.startCol === coord.col &&
              r.endCol === coord.col,
          );
          if (dupIdx !== -1) {
            ranges = [...ranges.slice(0, dupIdx), ...ranges.slice(dupIdx + 1)];
            // activeCell follows the last surviving range's anchor, or null.
            const last = ranges[ranges.length - 1];
            activeCell = last ? { row: last.anchorRow, col: last.anchorCol } : null;
            publish();
            return;
          }
          ranges = [...ranges, rectFrom(coord.row, coord.col, coord.row, coord.col, colIndexOf())];
          activeCell = { ...coord };
          publish();
        },

        extendTo(coord) {
          const anchor = resolveAnchor();
          if (!anchor) {
            api.selectCell(coord);
            return;
          }
          const next = rectFrom(anchor.row, anchor.col, coord.row, coord.col, colIndexOf());
          if (ranges.length === 0) ranges = [next];
          else ranges = [...ranges.slice(0, -1), next];
          activeCell = { ...coord };
          publish();
        },

        selectRow(rowIndex, mode = 'replace') {
          const cols = columnsOf();
          if (cols.length === 0) return;
          const first = cols[0];
          const last = cols[cols.length - 1];
          if (mode === 'extend') {
            const anchor = resolveAnchor();
            if (!anchor) {
              api.selectRow(rowIndex, 'replace');
              return;
            }
            const next: InternalRange = {
              startRow: Math.min(anchor.row, rowIndex),
              endRow: Math.max(anchor.row, rowIndex),
              startCol: first.id,
              endCol: last.id,
              anchorRow: anchor.row,
              anchorCol: first.id,
            };
            if (ranges.length === 0) ranges = [next];
            else ranges = [...ranges.slice(0, -1), next];
            activeCell = { row: rowIndex, col: first.id };
            publish();
            return;
          }
          const rowRange: InternalRange = {
            startRow: rowIndex,
            endRow: rowIndex,
            startCol: first.id,
            endCol: last.id,
            anchorRow: rowIndex,
            anchorCol: first.id,
          };
          ranges = mode === 'add' ? [...ranges, rowRange] : [rowRange];
          activeCell = { row: rowIndex, col: first.id };
          publish();
        },

        selectColumn(columnId, mode = 'replace') {
          const lastRow = ctx.grid.rowCount - 1;
          if (lastRow < 0) return;
          if (mode === 'extend') {
            const anchor = resolveAnchor();
            if (!anchor) {
              api.selectColumn(columnId, 'replace');
              return;
            }
            // Column-extend always spans every row; the anchor's column
            // (not row) is what defines the horizontal span.
            const next = rectFrom(0, anchor.col, lastRow, columnId, colIndexOf());
            next.anchorRow = 0;
            next.startRow = 0;
            next.endRow = lastRow;
            if (ranges.length === 0) ranges = [next];
            else ranges = [...ranges.slice(0, -1), next];
            activeCell = { row: 0, col: columnId };
            publish();
            return;
          }
          const colRange: InternalRange = {
            startRow: 0,
            endRow: lastRow,
            startCol: columnId,
            endCol: columnId,
            anchorRow: 0,
            anchorCol: columnId,
          };
          ranges = mode === 'add' ? [...ranges, colRange] : [colRange];
          activeCell = { row: 0, col: columnId };
          publish();
        },

        selectAll() {
          const cols = columnsOf();
          const lastRow = ctx.grid.rowCount - 1;
          if (cols.length === 0 || lastRow < 0) {
            api.clear();
            return;
          }
          const first = cols[0];
          const last = cols[cols.length - 1];
          ranges = [
            {
              startRow: 0,
              endRow: lastRow,
              startCol: first.id,
              endCol: last.id,
              anchorRow: 0,
              anchorCol: first.id,
            },
          ];
          activeCell = { row: 0, col: first.id };
          publish();
        },

        clear() {
          if (ranges.length === 0 && activeCell === null) return;
          clearInternal();
          publish();
        },

        isCellSelected(rowIndex, columnId) {
          if (ranges.length === 0) return false;
          const idx = colIndexOf();
          for (const r of ranges) {
            if (rangeContains(r, rowIndex, columnId, idx)) return true;
          }
          return false;
        },

        isCellActive(rowIndex, columnId) {
          return activeCell !== null && activeCell.row === rowIndex && activeCell.col === columnId;
        },
      };

      ctx.expose('selection', api);

      // Visual feedback: active cell and any selected cell get distinct classes.
      // `gs-cell--focused` is kept as an alias for `gs-cell--active` so existing
      // styles and tests written for keyboard focus continue to work.
      ctx.addCellDecorator(({ row, col }) => {
        const active = api.isCellActive(row, col);
        const selected = api.isCellSelected(row, col);
        if (!active && !selected) return null;
        const classes: string[] = [];
        if (selected) classes.push('gs-cell--selected');
        if (active) classes.push('gs-cell--active', 'gs-cell--focused');
        return { className: classes.join(' '), attributes: { 'aria-selected': 'true' } };
      });

      // View indices are invalidated when the data shape changes; clear to
      // avoid pointing at a different underlying row/column than the user saw.
      const unsubs = [
        ctx.events.on('sort:change', () => api.clear()),
        ctx.events.on('filter:change', () => api.clear()),
        ctx.events.on('data:rowsUpdate', () => api.clear()),
        ctx.events.on('columns:update', () => {
          cachedCols = null; // invalidate cache before clearing
          api.clear();
        }),
      ];

      return () => {
        for (const u of unsubs) u();
        ranges = [];
        activeCell = null;
        cachedCols = null;
        cachedIndex = new Map();
        cachedSnapshot = null;
      };
    },
  };

  return plugin;
}
