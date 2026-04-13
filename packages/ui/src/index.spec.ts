import { describe, expect, it } from 'vitest';

import { VERSION } from './index';

describe('ui', () => {
  it('re-exports VERSION from core', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
