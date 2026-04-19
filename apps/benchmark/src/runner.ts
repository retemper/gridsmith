import { measureEditLatency, measureScrollFps, memoryUsageMb, waitForPaint } from './metrics';
import type { BenchmarkConfig, BenchmarkRow, GridAdapter, MetricResult } from './types';

export async function runBenchmark(
  adapter: GridAdapter,
  container: HTMLElement,
  rows: BenchmarkRow[],
  config: BenchmarkConfig,
): Promise<Omit<MetricResult, 'bundleKb'>> {
  container.textContent = '';
  const memBefore = memoryUsageMb();
  const renderStart = performance.now();
  const handle = await adapter.mount(container, rows);
  await waitForPaint();
  const renderMs = performance.now() - renderStart;

  const scrollFps = await measureScrollFps(handle, config.scrollFrames, config.scrollDeltaPx);

  const editLatencyMs = await measureEditLatency(handle, Math.floor(rows.length / 2));

  const memAfter = memoryUsageMb();
  const memoryMb = memBefore != null && memAfter != null ? memAfter - memBefore : memAfter;

  handle.destroy();
  await waitForPaint();

  return { renderMs, scrollFps, editLatencyMs, memoryMb };
}
