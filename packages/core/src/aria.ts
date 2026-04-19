// ARIA helpers for the WAI-ARIA 1.2 grid pattern.
//
// The grid's aria-rowcount includes header rows per spec; first data row's
// aria-rowindex is `headerDepth + pinnedTop + 1` (1-based).

export interface AriaRowCountInput {
  headerDepth: number;
  pinnedTop: number;
  rowCount: number;
  pinnedBottom: number;
}

export function computeRowCount({
  headerDepth,
  pinnedTop,
  rowCount,
  pinnedBottom,
}: AriaRowCountInput): number {
  return headerDepth + pinnedTop + rowCount + pinnedBottom;
}

export function dataRowAriaIndex(viewRow: number, headerDepth: number, pinnedTop: number): number {
  return headerDepth + pinnedTop + viewRow + 1;
}

export function pinnedTopAriaIndex(offset: number, headerDepth: number): number {
  return headerDepth + offset + 1;
}

export function pinnedBottomAriaIndex(
  offset: number,
  headerDepth: number,
  pinnedTop: number,
  rowCount: number,
): number {
  return headerDepth + pinnedTop + rowCount + offset + 1;
}

export function headerRowAriaIndex(rowIndex: number): number {
  return rowIndex + 1;
}

let cellIdCounter = 0;
export function nextGridInstanceId(): string {
  return `gs-${++cellIdCounter}`;
}

export function buildCellId(gridId: string, viewRow: number, colId: string): string {
  return `${gridId}-r${viewRow}-c${sanitizeColId(colId)}`;
}

export function buildPinnedCellId(
  gridId: string,
  position: 'top' | 'bottom',
  dataIndex: number,
  colId: string,
): string {
  return `${gridId}-p${position[0]}${dataIndex}-c${sanitizeColId(colId)}`;
}

function sanitizeColId(colId: string): string {
  return colId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ─── Announcer ───────────────────────────────────────────

export interface Announcer {
  announce(message: string): void;
  destroy(): void;
}

export function createAnnouncer(target: HTMLElement, delay = 150): Announcer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: string | null = null;
  let destroyed = false;

  function flush() {
    timer = null;
    if (destroyed || pending === null) return;
    // Reset to empty then set — some screen readers skip duplicate text.
    target.textContent = '';
    const msg = pending;
    pending = null;
    // Microtask delay so the empty-text reset is observed before the new text.
    queueMicrotask(() => {
      if (destroyed) return;
      target.textContent = msg;
    });
  }

  return {
    announce(message: string) {
      if (destroyed) return;
      pending = message;
      if (timer !== null) return;
      timer = setTimeout(flush, delay);
    },
    destroy() {
      destroyed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      target.textContent = '';
    },
  };
}
