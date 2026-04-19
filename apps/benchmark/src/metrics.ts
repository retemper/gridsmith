import type { GridHandle } from './types';

export async function measureScrollFps(
  handle: GridHandle,
  frameCount: number,
  deltaPerFrame: number,
): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    function tick(): void {
      handle.scrollBy(deltaPerFrame);
      frames++;
      if (frames >= frameCount) {
        const elapsed = performance.now() - start;
        resolve((frames / elapsed) * 1000);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export async function measureEditLatency(handle: GridHandle, rowIndex: number): Promise<number> {
  const start = performance.now();
  await handle.editCell(rowIndex, 'name', `edited-${rowIndex}`);
  return performance.now() - start;
}

interface MemoryPerformance extends Performance {
  memory?: { usedJSHeapSize: number };
}

export function memoryUsageMb(): number | null {
  const perf = performance as MemoryPerformance;
  if (perf.memory && typeof perf.memory.usedJSHeapSize === 'number') {
    return perf.memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
}

export async function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
