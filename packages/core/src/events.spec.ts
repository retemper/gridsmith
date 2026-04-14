import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './events';

interface TestEvents {
  ping: { message: string };
  count: { n: number };
}

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = createEventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('ping', fn);

    bus.emit('ping', { message: 'hello' });
    expect(fn).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('supports multiple handlers for the same event', () => {
    const bus = createEventBus<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('ping', fn1);
    bus.on('ping', fn2);

    bus.emit('ping', { message: 'test' });
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes handlers', () => {
    const bus = createEventBus<TestEvents>();
    const fn = vi.fn();
    const unsub = bus.on('ping', fn);

    bus.emit('ping', { message: 'a' });
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    bus.emit('ping', { message: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('once() fires handler only once', () => {
    const bus = createEventBus<TestEvents>();
    const fn = vi.fn();
    bus.once('ping', fn);

    bus.emit('ping', { message: 'first' });
    bus.emit('ping', { message: 'second' });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ message: 'first' });
  });

  it('does not fire handlers for different events', () => {
    const bus = createEventBus<TestEvents>();
    const fn = vi.fn();
    bus.on('ping', fn);

    bus.emit('count', { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears everything', () => {
    const bus = createEventBus<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('ping', fn1);
    bus.on('count', fn2);

    bus.removeAllListeners();

    bus.emit('ping', { message: 'test' });
    bus.emit('count', { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('emitting with no handlers does not throw', () => {
    const bus = createEventBus<TestEvents>();
    expect(() => bus.emit('ping', { message: 'test' })).not.toThrow();
  });
});
