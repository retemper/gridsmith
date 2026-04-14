import { describe, expect, it, vi } from 'vitest';

import { createGrid } from './grid';
import { resolvePluginOrder } from './plugin';
import type { GridPlugin } from './types';

describe('resolvePluginOrder', () => {
  it('returns plugins in order when no dependencies', () => {
    const a: GridPlugin = { name: 'a', init: vi.fn() };
    const b: GridPlugin = { name: 'b', init: vi.fn() };
    const result = resolvePluginOrder([a, b]);
    expect(result.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('sorts by dependencies', () => {
    const a: GridPlugin = { name: 'a', dependencies: ['b'], init: vi.fn() };
    const b: GridPlugin = { name: 'b', init: vi.fn() };
    const result = resolvePluginOrder([a, b]);
    expect(result.map((p) => p.name)).toEqual(['b', 'a']);
  });

  it('handles deep dependency chains', () => {
    const a: GridPlugin = { name: 'a', dependencies: ['b'], init: vi.fn() };
    const b: GridPlugin = { name: 'b', dependencies: ['c'], init: vi.fn() };
    const c: GridPlugin = { name: 'c', init: vi.fn() };
    const result = resolvePluginOrder([a, b, c]);
    expect(result.map((p) => p.name)).toEqual(['c', 'b', 'a']);
  });

  it('throws on circular dependencies', () => {
    const a: GridPlugin = { name: 'a', dependencies: ['b'], init: vi.fn() };
    const b: GridPlugin = { name: 'b', dependencies: ['a'], init: vi.fn() };
    expect(() => resolvePluginOrder([a, b])).toThrow(/Circular/);
  });

  it('throws on missing dependency', () => {
    const a: GridPlugin = { name: 'a', dependencies: ['missing'], init: vi.fn() };
    expect(() => resolvePluginOrder([a])).toThrow(/missing/);
  });

  it('throws on duplicate names', () => {
    const a1: GridPlugin = { name: 'a', init: vi.fn() };
    const a2: GridPlugin = { name: 'a', init: vi.fn() };
    expect(() => resolvePluginOrder([a1, a2])).toThrow(/Duplicate/);
  });
});

describe('createPluginManager', () => {
  it('initializes plugins and exposes APIs', () => {
    const plugin: GridPlugin = {
      name: 'test',
      init(ctx) {
        ctx.expose('test', { hello: () => 'world' });
      },
    };

    const grid = createGrid({
      data: [],
      columns: [],
      plugins: [plugin],
    });

    const api = grid.getPlugin<{ hello: () => string }>('test');
    expect(api?.hello()).toBe('world');
  });

  it('destroys plugins in reverse order', () => {
    const order: string[] = [];
    const a: GridPlugin = {
      name: 'a',
      init: () => () => order.push('a'),
    };
    const b: GridPlugin = {
      name: 'b',
      init: () => () => order.push('b'),
    };

    const grid = createGrid({ data: [], columns: [], plugins: [a, b] });
    grid.destroy();

    expect(order).toEqual(['b', 'a']);
  });

  it('plugins can access each other via getPlugin', () => {
    const provider: GridPlugin = {
      name: 'provider',
      init(ctx) {
        ctx.expose('provider', { value: 42 });
      },
    };

    let receivedValue: number | undefined;
    const consumer: GridPlugin = {
      name: 'consumer',
      dependencies: ['provider'],
      init(ctx) {
        const p = ctx.getPlugin<{ value: number }>('provider');
        receivedValue = p?.value;
      },
    };

    createGrid({ data: [], columns: [], plugins: [provider, consumer] });
    expect(receivedValue).toBe(42);
  });

  it('plugins can add cell decorators', () => {
    const plugin: GridPlugin = {
      name: 'highlight',
      init(ctx) {
        ctx.addCellDecorator((cell) => {
          if (cell.value === 'special') {
            return { className: 'highlighted' };
          }
          return null;
        });
      },
    };

    const grid = createGrid({
      data: [{ name: 'special' }, { name: 'normal' }],
      columns: [{ id: 'name', header: 'Name' }],
      plugins: [plugin],
    });

    const decs = grid.getCellDecorations(0, 'name');
    expect(decs).toHaveLength(1);
    expect(decs[0]!.className).toBe('highlighted');

    const decs2 = grid.getCellDecorations(1, 'name');
    expect(decs2).toHaveLength(0);
  });

  it('emits plugin:ready for each plugin', () => {
    const readyNames: string[] = [];
    const plugin: GridPlugin = {
      name: 'test-plugin',
      init(ctx) {
        ctx.events.on('plugin:ready', ({ name }) => {
          readyNames.push(name);
        });
      },
    };

    const plugin2: GridPlugin = {
      name: 'second',
      dependencies: ['test-plugin'],
      init: vi.fn(),
    };

    createGrid({ data: [], columns: [], plugins: [plugin, plugin2] });
    // plugin receives ready event for second (not itself, since it subscribes after its own init)
    expect(readyNames).toContain('second');
  });
});
