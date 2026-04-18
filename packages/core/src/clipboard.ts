import type {
  CellRange,
  CellValue,
  ClipboardPayload,
  ClipboardPluginApi,
  ColumnDef,
  ColumnType,
  GridPlugin,
  SelectionPluginApi,
} from './types';

// ─── Formatting ─────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatCell(value: CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function parseCell(raw: string, type: ColumnType | undefined): CellValue {
  if (raw === '') return null;
  switch (type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'checkbox': {
      const u = raw.toUpperCase();
      if (u === 'TRUE' || u === '1') return true;
      if (u === 'FALSE' || u === '0') return false;
      return raw;
    }
    case 'date': {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d;
    }
    default:
      return raw;
  }
}

// ─── TSV ────────────────────────────────────────────────────

function tsvEscape(cell: string): string {
  // Only quote when the value contains a delimiter, a newline, or a quote —
  // matches what Excel writes and keeps the common case un-quoted.
  if (/[\t\r\n"]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function serializeTsv(matrix: readonly (readonly string[])[]): string {
  return matrix.map((row) => row.map(tsvEscape).join('\t')).join('\n');
}

/**
 * Parse TSV text into a 2-D string matrix. Supports quoted cells with
 * embedded tabs, quotes (doubled), and newlines (CRLF/LF/CR). Trailing empty
 * line is dropped to match Excel's copy output.
 */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = '';
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === '\t') {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Flush the final cell/row when the payload did not end in a newline.
  if (cell !== '' || row.length > 0 || inQuotes) pushRow();
  // Excel appends a trailing newline, which produces an empty final row here.
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === '') rows.pop();
  }
  return rows;
}

// ─── HTML ───────────────────────────────────────────────────

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeHtml(matrix: readonly (readonly string[])[]): string {
  const body = matrix
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${htmlEscape(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table><tbody>${body}</tbody></table>`;
}

/**
 * Parse HTML containing a single `<table>` into a 2-D string matrix. Returns
 * null if no table is present — callers fall back to TSV in that case. Uses
 * DOMParser when available; otherwise returns null (Node environments rely
 * on the TSV path).
 */
function parseHtml(html: string): string[][] | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const rows: string[][] = [];
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('td, th')).map((td) => {
      // `textContent` preserves whitespace; `<br>` becomes a newline so
      // multi-line cells roundtrip via HTML.
      const clone = td.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      return clone.textContent ?? '';
    });
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// ─── Column utilities ───────────────────────────────────────

function colRangeIndices(
  range: CellRange,
  columns: readonly ColumnDef[],
): { startIdx: number; endIdx: number } {
  const startIdx = columns.findIndex((c) => c.id === range.startCol);
  const endIdx = columns.findIndex((c) => c.id === range.endCol);
  // When an id isn't resolvable (stale after column change), treat the range
  // as degenerate — the caller checks for -1 and bails.
  if (startIdx === -1 || endIdx === -1) return { startIdx: -1, endIdx: -1 };
  return {
    startIdx: Math.min(startIdx, endIdx),
    endIdx: Math.max(startIdx, endIdx),
  };
}

// ─── Clipboard I/O (DOM) ────────────────────────────────────

async function writeToClipboard(payload: ClipboardPayload): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  // Prefer `write` so HTML rides along for rich-paste targets. Not every
  // browser (or permission policy) allows it — fall back to plain text on
  // any failure.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([payload.text], { type: 'text/plain' }),
        'text/html': new Blob([payload.html], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // fall through to writeText
    }
  }
  if (!navigator.clipboard.writeText) return false;
  try {
    await navigator.clipboard.writeText(payload.text);
    return true;
  } catch {
    return false;
  }
}

async function readFromClipboard(): Promise<{ text?: string; html?: string } | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null;
  if (navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      let text: string | undefined;
      let html: string | undefined;
      for (const item of items) {
        if (!html && item.types.includes('text/html')) {
          html = await (await item.getType('text/html')).text();
        }
        if (!text && item.types.includes('text/plain')) {
          text = await (await item.getType('text/plain')).text();
        }
      }
      if (text !== undefined || html !== undefined) return { text, html };
    } catch {
      // fall through to readText
    }
  }
  if (!navigator.clipboard.readText) return null;
  try {
    const text = await navigator.clipboard.readText();
    return { text };
  } catch {
    return null;
  }
}

// ─── Plugin ─────────────────────────────────────────────────

export function createClipboardPlugin(): GridPlugin {
  const plugin: GridPlugin = {
    name: 'clipboard',
    dependencies: ['selection'],

    init(ctx) {
      const columnsOf = () => ctx.grid.columns.get();

      const getSelectionApi = (): SelectionPluginApi | undefined =>
        ctx.getPlugin<SelectionPluginApi>('selection');

      /**
       * Pick the range we treat as "the selection" for copy/cut. Matches
       * Excel's rule that clipboard ops bind to the most recently anchored
       * range (the one containing `activeCell`).
       */
      const activeRange = (): CellRange | null => {
        const sel = getSelectionApi()?.getState();
        if (!sel || sel.ranges.length === 0) return null;
        return sel.ranges[sel.ranges.length - 1];
      };

      const rangeMatrix = (range: CellRange): string[][] => {
        const cols = columnsOf();
        const { startIdx, endIdx } = colRangeIndices(range, cols);
        if (startIdx === -1) return [];
        const rowCount = ctx.grid.rowCount;
        const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
        const endRow = Math.min(rowCount - 1, Math.max(range.startRow, range.endRow));
        const out: string[][] = [];
        for (let r = startRow; r <= endRow; r++) {
          const row: string[] = [];
          for (let c = startIdx; c <= endIdx; c++) {
            row.push(formatCell(ctx.grid.getCell(r, cols[c].id)));
          }
          out.push(row);
        }
        return out;
      };

      const serializeRange = (range: CellRange): ClipboardPayload => {
        const matrix = rangeMatrix(range);
        return { text: serializeTsv(matrix), html: serializeHtml(matrix) };
      };

      const parsePayload = (payload: { text?: string; html?: string }): string[][] | null => {
        if (payload.html) {
          const parsed = parseHtml(payload.html);
          // Only prefer HTML when it produced actual rows — an empty
          // `<table>` should fall through to the TSV payload if present.
          if (parsed && parsed.length > 0) return parsed;
        }
        if (payload.text !== undefined) {
          const parsed = parseTsv(payload.text);
          return parsed.length > 0 ? parsed : null;
        }
        return null;
      };

      const applyMatrix: ClipboardPluginApi['applyMatrix'] = (matrix, startRow, startCol) => {
        if (matrix.length === 0) return;
        const cols = columnsOf();
        const startIdx = cols.findIndex((c) => c.id === startCol);
        if (startIdx === -1) return;
        const rowCount = ctx.grid.rowCount;
        ctx.grid.batchUpdate(() => {
          for (let r = 0; r < matrix.length; r++) {
            const destRow = startRow + r;
            if (destRow < 0 || destRow >= rowCount) continue;
            const row = matrix[r];
            for (let c = 0; c < row.length; c++) {
              const destCol = cols[startIdx + c];
              if (!destCol) continue;
              if (destCol.editable === false) continue;
              const raw = row[c];
              const value =
                typeof raw === 'string' ? parseCell(raw, destCol.type) : (raw as CellValue);
              ctx.grid.setCell(destRow, destCol.id, value);
            }
          }
        });
      };

      const rangeSize = (range: CellRange): { rows: number; cols: number } => {
        const cols = columnsOf();
        const { startIdx, endIdx } = colRangeIndices(range, cols);
        if (startIdx === -1) return { rows: 0, cols: 0 };
        return {
          rows: Math.abs(range.endRow - range.startRow) + 1,
          cols: endIdx - startIdx + 1,
        };
      };

      const deleteSelection = (): boolean => {
        const sel = getSelectionApi()?.getState();
        if (!sel || sel.ranges.length === 0) return false;
        const cols = columnsOf();
        const rowCount = ctx.grid.rowCount;
        ctx.grid.batchUpdate(() => {
          for (const r of sel.ranges) {
            const { startIdx, endIdx } = colRangeIndices(r, cols);
            if (startIdx === -1) continue;
            const startRow = Math.max(0, Math.min(r.startRow, r.endRow));
            const endRow = Math.min(rowCount - 1, Math.max(r.startRow, r.endRow));
            for (let row = startRow; row <= endRow; row++) {
              for (let c = startIdx; c <= endIdx; c++) {
                const col = cols[c];
                if (col.editable === false) continue;
                // Skip cells already null — avoids a redundant data:change and
                // keeps the batch minimal, but the overall return is still
                // "handled" because a selection existed.
                if (ctx.grid.getCell(row, col.id) == null) continue;
                ctx.grid.setCell(row, col.id, null);
              }
            }
          }
        });
        return true;
      };

      const api: ClipboardPluginApi = {
        async copy() {
          const range = activeRange();
          if (!range) return false;
          // Only bail when the range itself is unresolvable (stale column ids,
          // zero rows). An all-empty range still serializes to tabs/newlines
          // and should round-trip faithfully.
          if (rangeMatrix(range).length === 0) return false;
          const payload = serializeRange(range);
          const ok = await writeToClipboard(payload);
          if (ok) {
            const { rows, cols } = rangeSize(range);
            ctx.events.emit('clipboard:copy', { range, rows, cols });
          }
          return ok;
        },

        async cut() {
          const range = activeRange();
          if (!range) return false;
          if (rangeMatrix(range).length === 0) return false;
          const payload = serializeRange(range);
          const ok = await writeToClipboard(payload);
          if (!ok) return false;
          const cols = columnsOf();
          const { startIdx, endIdx } = colRangeIndices(range, cols);
          const rowCount = ctx.grid.rowCount;
          ctx.grid.batchUpdate(() => {
            const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
            const endRow = Math.min(rowCount - 1, Math.max(range.startRow, range.endRow));
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startIdx; c <= endIdx; c++) {
                const col = cols[c];
                if (col.editable === false) continue;
                ctx.grid.setCell(r, col.id, null);
              }
            }
          });
          const size = rangeSize(range);
          ctx.events.emit('clipboard:cut', { range, rows: size.rows, cols: size.cols });
          return true;
        },

        async paste() {
          const sel = getSelectionApi()?.getState();
          const target = sel?.activeCell ?? null;
          if (!target) return false;
          const payload = await readFromClipboard();
          if (!payload) return false;
          const matrix = parsePayload(payload);
          if (!matrix || matrix.length === 0) return false;
          applyMatrix(matrix, target.row, target.col);
          ctx.events.emit('clipboard:paste', {
            target: { ...target },
            rows: matrix.length,
            cols: matrix[0]?.length ?? 0,
          });
          return true;
        },

        deleteSelection,
        serializeRange,
        parsePayload,
        applyMatrix,
      };

      ctx.expose('clipboard', api);

      // No subscriptions today, but match the selection/editing plugin
      // convention so future additions (e.g. copy-marquee decoration) don't
      // silently leak listeners.
      return () => {
        /* noop */
      };
    },
  };

  return plugin;
}
