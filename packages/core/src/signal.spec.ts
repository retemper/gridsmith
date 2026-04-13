import { describe, expect, it, vi } from 'vitest';

import { signal, computed, batch } from './signal';

describe('signal', () => {
  it('stores and retrieves a value', () => {
    const s = signal(42);
    expect(s.get()).toBe(42);
  });

  it('updates value with set()', () => {
    const s = signal('hello');
    s.set('world');
    expect(s.get()).toBe('world');
  });

  it('updates value with update()', () => {
    const s = signal(10);
    s.update((v) => v + 5);
    expect(s.get()).toBe(15);
  });

  it('notifies subscribers on change', () => {
    const s = signal(0);
    const fn = vi.fn();
    s.subscribe(fn);

    s.set(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not notify when value is the same (Object.is)', () => {
    const s = signal(1);
    const fn = vi.fn();
    s.subscribe(fn);

    s.set(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes correctly', () => {
    const s = signal(0);
    const fn = vi.fn();
    const unsub = s.subscribe(fn);

    s.set(1);
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    s.set(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('peek() reads without tracking', () => {
    const s = signal(5);
    expect(s.peek()).toBe(5);
  });

  it('supports multiple subscribers', () => {
    const s = signal(0);
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    s.subscribe(fn1);
    s.subscribe(fn2);

    s.set(1);
    expect(fn1).toHaveBeenCalledWith(1);
    expect(fn2).toHaveBeenCalledWith(1);
  });
});

describe('computed', () => {
  it('derives value from signals', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());

    expect(sum.get()).toBe(5);
  });

  it('recomputes when dependency changes', () => {
    const a = signal(1);
    const doubled = computed(() => a.get() * 2);

    expect(doubled.get()).toBe(2);
    a.set(5);
    expect(doubled.get()).toBe(10);
  });

  it('notifies subscribers when value changes', () => {
    const a = signal(1);
    const doubled = computed(() => a.get() * 2);
    const fn = vi.fn();

    doubled.subscribe(fn);
    a.set(3);
    expect(fn).toHaveBeenCalledWith(6);
  });

  it('is lazy - does not compute until read', () => {
    const fn = vi.fn(() => 42);
    const c = computed(fn);

    expect(fn).not.toHaveBeenCalled();
    c.get();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('peek() reads without tracking', () => {
    const a = signal(3);
    const c = computed(() => a.get() + 1);
    expect(c.peek()).toBe(4);
  });

  it('chains computed values', () => {
    const a = signal(1);
    const b = computed(() => a.get() * 2);
    const c = computed(() => b.get() + 10);

    expect(c.get()).toBe(12);
    a.set(5);
    expect(c.get()).toBe(20);
  });

  it('unsubscribes from computed', () => {
    const a = signal(1);
    const c = computed(() => a.get() * 2);
    const fn = vi.fn();

    const unsub = c.subscribe(fn);
    a.set(2);
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    a.set(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('batch', () => {
  it('defers notifications until batch completes', () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn();
    a.subscribe(fn);
    b.subscribe(fn);

    batch(() => {
      a.set(10);
      b.set(20);
      expect(fn).not.toHaveBeenCalled();
    });

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('notifies computed subscribers after batch', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.get() + b.get());
    const fn = vi.fn();
    sum.subscribe(fn);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    expect(sum.get()).toBe(30);
  });

  it('supports nested batches', () => {
    const s = signal(0);
    const fn = vi.fn();
    s.subscribe(fn);

    batch(() => {
      s.set(1);
      batch(() => {
        s.set(2);
      });
      // inner batch does not flush
      expect(fn).not.toHaveBeenCalled();
    });

    // only outermost batch flushes
    expect(fn).toHaveBeenCalled();
  });
});
