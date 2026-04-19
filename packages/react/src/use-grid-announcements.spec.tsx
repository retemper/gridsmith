import {
  createClipboardPlugin,
  createEditingPlugin,
  createGrid,
  createSelectionPlugin,
  createValidationPlugin,
  type ClipboardPluginApi,
  type ColumnDef,
  type SelectionPluginApi,
  type ValidationPluginApi,
} from '@gridsmith/core';
import { act, renderHook } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGridAnnouncements } from './use-grid-announcements';

const columns: ColumnDef[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'age', header: 'Age', type: 'number' },
];

type Setup = {
  grid: ReturnType<typeof createGrid>;
  politeEl: HTMLDivElement;
  assertiveEl: HTMLDivElement;
  unmount: () => void;
};

function renderWith(
  grid: ReturnType<typeof createGrid>,
  options: { attachPolite?: boolean; attachAssertive?: boolean } = {},
): Setup {
  const politeEl = document.createElement('div');
  const assertiveEl = document.createElement('div');
  const { attachPolite = true, attachAssertive = true } = options;

  const { unmount } = renderHook(() => {
    const politeRef = useRef<HTMLDivElement | null>(attachPolite ? politeEl : null);
    const assertiveRef = useRef<HTMLDivElement | null>(attachAssertive ? assertiveEl : null);
    useGridAnnouncements(
      grid,
      politeRef as RefObject<HTMLElement | null>,
      assertiveRef as RefObject<HTMLElement | null>,
    );
  });

  return { grid, politeEl, assertiveEl, unmount };
}

async function flushAnnouncer() {
  await vi.advanceTimersByTimeAsync(200);
  await Promise.resolve();
}

describe('useGridAnnouncements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces sort application and clearing via the polite region', async () => {
    const grid = createGrid({
      data: [{ name: 'b', age: 1 }],
      columns: [
        { id: 'name', header: 'Name', type: 'text', sortable: true },
        { id: 'age', header: 'Age', type: 'number' },
      ],
    });
    const { politeEl, unmount } = renderWith(grid);

    act(() => {
      grid.sortState.set([{ columnId: 'name', direction: 'asc' }]);
    });
    await flushAnnouncer();
    expect(politeEl.textContent).toBe('Sorted by Name ascending');

    act(() => {
      grid.sortState.set([]);
    });
    await flushAnnouncer();
    expect(politeEl.textContent).toBe('Sort cleared');

    unmount();
  });

  it('falls back to the column id when no header is available', async () => {
    const grid = createGrid({
      data: [{ name: 'a', age: 2 }],
      columns: [
        { id: 'name', header: '', type: 'text', sortable: true },
        { id: 'age', header: 'Age', type: 'number' },
      ],
    });
    const { politeEl, unmount } = renderWith(grid);

    act(() => {
      grid.sortState.set([{ columnId: 'missing', direction: 'desc' }]);
    });
    await flushAnnouncer();
    expect(politeEl.textContent).toBe('Sorted by missing descending');

    unmount();
  });

  it('announces filter row counts', async () => {
    const grid = createGrid({
      data: [
        { name: 'a', age: 1 },
        { name: 'b', age: 2 },
      ],
      columns,
    });
    const { politeEl, unmount } = renderWith(grid);

    act(() => {
      grid.filterState.set([{ columnId: 'name', operator: 'eq', value: 'a' }]);
    });
    await flushAnnouncer();
    expect(politeEl.textContent).toMatch(/^Showing \d+ rows$/);

    unmount();
  });

  it('announces clipboard paste shape with singular/plural wording', async () => {
    // Stub the browser clipboard so `paste()` resolves a deterministic
    // matrix. Each test case swaps `readText` to the payload it wants.
    let clipboardText = '';
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: {
        readText: () => Promise.resolve(clipboardText),
      },
    });

    try {
      const grid = createGrid({
        data: [
          { name: 'a', age: 1 },
          { name: 'b', age: 2 },
        ],
        columns,
        plugins: [createSelectionPlugin(), createClipboardPlugin()],
      });
      const clipboard = grid.getPlugin<ClipboardPluginApi>('clipboard')!;
      const selection = grid.getPlugin<SelectionPluginApi>('selection')!;
      const { politeEl, unmount } = renderWith(grid);

      selection.selectCell({ row: 0, col: 'name' });
      clipboardText = 'solo';
      await act(async () => {
        await clipboard.paste();
      });
      await flushAnnouncer();
      expect(politeEl.textContent).toBe('Pasted 1 row by 1 column');

      selection.selectCell({ row: 0, col: 'name' });
      clipboardText = 'a\tb\nc\td';
      await act(async () => {
        await clipboard.paste();
      });
      await flushAnnouncer();
      expect(politeEl.textContent).toBe('Pasted 2 rows by 2 columns');

      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('announces newly-added validation errors only once per key', async () => {
    const grid = createGrid({
      data: [{ name: 'Alice', age: 30 }],
      columns: [
        {
          id: 'name',
          header: 'Name',
          type: 'text',
          validate: (v) => (typeof v === 'string' && v.length > 0) || 'Name required',
        },
        { id: 'age', header: 'Age', type: 'number' },
      ],
      plugins: [createEditingPlugin(), createValidationPlugin()],
    });
    const validation = grid.getPlugin<ValidationPluginApi>('validation')!;
    const { assertiveEl, unmount } = renderWith(grid);

    act(() => {
      validation.validateCell(0, 'name', '');
    });
    await flushAnnouncer();
    expect(assertiveEl.textContent).toBe('Invalid: Name required');

    // Same error repeated — key-diff should suppress.
    assertiveEl.textContent = '';
    act(() => {
      validation.validateCell(0, 'name', '');
    });
    await flushAnnouncer();
    expect(assertiveEl.textContent).toBe('');

    unmount();
  });

  it('no-ops when either ref is not attached to an element', () => {
    const grid = createGrid({ data: [{ name: 'a', age: 1 }], columns });
    const { politeEl, assertiveEl, unmount } = renderWith(grid, { attachAssertive: false });

    act(() => {
      grid.sortState.set([]);
    });
    expect(politeEl.textContent).toBe('');
    expect(assertiveEl.textContent).toBe('');
    unmount();
  });

  it('tears down subscriptions on unmount (no announcements after)', async () => {
    const grid = createGrid({
      data: [{ name: 'a', age: 1 }],
      columns: [
        { id: 'name', header: 'Name', type: 'text', sortable: true },
        { id: 'age', header: 'Age', type: 'number' },
      ],
    });
    const { politeEl, unmount } = renderWith(grid);

    unmount();
    act(() => {
      grid.sortState.set([{ columnId: 'name', direction: 'asc' }]);
    });
    await flushAnnouncer();
    expect(politeEl.textContent).toBe('');
  });
});
