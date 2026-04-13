import { VERSION } from '@gridsmith/core';
import { bench, describe } from 'vitest';


describe('core baseline', () => {
  bench('import core', () => {
    void VERSION;
  });
});
