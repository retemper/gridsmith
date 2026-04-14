import { signal, computed } from '@gridsmith/core';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSignalValue } from './use-signal';

describe('useSignalValue', () => {
  it('reads the current signal value', () => {
    const s = signal(42);
    const { result } = renderHook(() => useSignalValue(s));
    expect(result.current).toBe(42);
  });

  it('re-renders when signal value changes', () => {
    const s = signal('hello');
    const { result } = renderHook(() => useSignalValue(s));
    expect(result.current).toBe('hello');

    act(() => s.set('world'));
    expect(result.current).toBe('world');
  });

  it('works with computed signals', () => {
    const count = signal(3);
    const doubled = computed(() => count.get() * 2);
    const { result } = renderHook(() => useSignalValue(doubled));
    expect(result.current).toBe(6);

    act(() => count.set(5));
    expect(result.current).toBe(10);
  });

  it('does not re-render when value is unchanged', () => {
    const s = signal(10);
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useSignalValue(s);
    });
    const initial = renderCount;

    act(() => s.set(10)); // same value
    expect(renderCount).toBe(initial);
  });
});
