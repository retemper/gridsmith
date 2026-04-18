import {
  createClipboardPlugin,
  createFillHandlePlugin,
  createGrid,
  createSelectionPlugin,
} from '@gridsmith/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useGridClipboard } from './use-grid-clipboard';
import { useGridFillHandle } from './use-grid-fill-handle';

describe('plugin accessor hooks', () => {
  it('returns the plugin api when registered', () => {
    const grid = createGrid({
      data: [{ a: null }],
      columns: [{ id: 'a', header: 'A', type: 'text' }],
      plugins: [createSelectionPlugin(), createClipboardPlugin(), createFillHandlePlugin()],
    });
    expect(renderHook(() => useGridClipboard(grid)).result.current).not.toBeNull();
    expect(renderHook(() => useGridFillHandle(grid)).result.current).not.toBeNull();
  });

  it('returns null when the plugin is not registered', () => {
    const grid = createGrid({
      data: [{ a: null }],
      columns: [{ id: 'a', header: 'A', type: 'text' }],
      plugins: [],
    });
    expect(renderHook(() => useGridClipboard(grid)).result.current).toBeNull();
    expect(renderHook(() => useGridFillHandle(grid)).result.current).toBeNull();
  });
});
