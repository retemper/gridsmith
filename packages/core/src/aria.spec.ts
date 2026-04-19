// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCellId,
  buildPinnedCellId,
  computeRowCount,
  createAnnouncer,
  dataRowAriaIndex,
  headerRowAriaIndex,
  nextGridInstanceId,
  pinnedBottomAriaIndex,
  pinnedTopAriaIndex,
} from './aria';

describe('aria helpers', () => {
  describe('index math', () => {
    it('computeRowCount sums all logical rows', () => {
      expect(computeRowCount({ headerDepth: 2, pinnedTop: 1, rowCount: 10, pinnedBottom: 1 })).toBe(
        14,
      );
      expect(computeRowCount({ headerDepth: 1, pinnedTop: 0, rowCount: 0, pinnedBottom: 0 })).toBe(
        1,
      );
    });

    it('dataRowAriaIndex is 1-based after headers + pinned top', () => {
      expect(dataRowAriaIndex(0, 2, 3)).toBe(6);
      expect(dataRowAriaIndex(5, 1, 0)).toBe(7);
    });

    it('pinnedTopAriaIndex offsets by header depth', () => {
      expect(pinnedTopAriaIndex(0, 2)).toBe(3);
      expect(pinnedTopAriaIndex(1, 1)).toBe(3);
    });

    it('pinnedBottomAriaIndex sits after data rows', () => {
      expect(pinnedBottomAriaIndex(0, 2, 1, 10)).toBe(14);
      expect(pinnedBottomAriaIndex(2, 1, 0, 5)).toBe(9);
    });

    it('headerRowAriaIndex is 1-based', () => {
      expect(headerRowAriaIndex(0)).toBe(1);
      expect(headerRowAriaIndex(3)).toBe(4);
    });
  });

  describe('id builders', () => {
    it('nextGridInstanceId returns monotonically increasing ids', () => {
      const a = nextGridInstanceId();
      const b = nextGridInstanceId();
      expect(a).toMatch(/^gs-\d+$/);
      expect(b).toMatch(/^gs-\d+$/);
      expect(a).not.toBe(b);
    });

    it('buildCellId composes safe id strings', () => {
      expect(buildCellId('gs-1', 0, 'name')).toBe('gs-1-r0-cname');
      // colId with invalid CSS selector chars gets sanitized
      expect(buildCellId('gs-1', 3, 'user.name[0]')).toBe('gs-1-r3-cuser_name_0_');
    });

    it('buildPinnedCellId encodes top/bottom + data index', () => {
      expect(buildPinnedCellId('gs-1', 'top', 4, 'age')).toBe('gs-1-pt4-cage');
      expect(buildPinnedCellId('gs-1', 'bottom', 99, 'x.y')).toBe('gs-1-pb99-cx_y');
    });
  });

  describe('createAnnouncer', () => {
    let target: HTMLDivElement;

    beforeEach(() => {
      vi.useFakeTimers();
      target = document.createElement('div');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces and writes the last pending message', async () => {
      const announcer = createAnnouncer(target, 100);
      announcer.announce('first');
      announcer.announce('second');
      expect(target.textContent).toBe('');

      vi.advanceTimersByTime(100);
      // Flush microtasks for the queueMicrotask in the announcer.
      await Promise.resolve();
      expect(target.textContent).toBe('second');
    });

    it('allows a follow-up announcement after the first flush', async () => {
      const announcer = createAnnouncer(target, 50);
      announcer.announce('hello');
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      expect(target.textContent).toBe('hello');

      announcer.announce('world');
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      expect(target.textContent).toBe('world');
    });

    it('destroy() cancels a pending announcement and clears text', async () => {
      const announcer = createAnnouncer(target, 100);
      announcer.announce('one');
      announcer.destroy();
      expect(target.textContent).toBe('');

      vi.advanceTimersByTime(200);
      await Promise.resolve();
      // Destroyed announcer should not write after the timer fires.
      expect(target.textContent).toBe('');

      // Subsequent announces are no-ops once destroyed.
      announcer.announce('two');
      vi.advanceTimersByTime(200);
      await Promise.resolve();
      expect(target.textContent).toBe('');
    });

    it('destroy() during the microtask gap does not write', async () => {
      const announcer = createAnnouncer(target, 10);
      announcer.announce('pending');
      vi.advanceTimersByTime(10);
      // Do NOT flush microtasks yet — destroy before the queued microtask runs.
      announcer.destroy();
      await Promise.resolve();
      expect(target.textContent).toBe('');
    });
  });
});
