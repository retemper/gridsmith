import { describe, expect, it } from 'vitest';

import { VERSION } from './index';

describe('core', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
