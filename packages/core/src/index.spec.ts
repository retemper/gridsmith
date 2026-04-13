import { describe, expect, it } from 'vitest';

import { VERSION, createGrid, signal, computed, batch, createEventBus } from './index';

describe('core exports', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports createGrid', () => {
    expect(typeof createGrid).toBe('function');
  });

  it('exports signal primitives', () => {
    expect(typeof signal).toBe('function');
    expect(typeof computed).toBe('function');
    expect(typeof batch).toBe('function');
  });

  it('exports createEventBus', () => {
    expect(typeof createEventBus).toBe('function');
  });
});
