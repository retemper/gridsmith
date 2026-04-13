import { describe, expect, it } from 'vitest';

import { VERSION } from './index';

describe('react adapter', () => {
  it('re-exports VERSION from core', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
