export interface BenchmarkRow {
  id: number;
  name: string;
  email: string;
  age: number;
  balance: number;
  active: boolean;
  joined: string;
}

export interface MetricResult {
  renderMs: number | null;
  scrollFps: number | null;
  editLatencyMs: number | null;
  memoryMb: number | null;
  bundleKb: number | null;
}

export type GridId = 'gridsmith' | 'ag-grid' | 'handsontable' | 'glide';

export interface GridAdapter {
  id: GridId;
  label: string;
  version: string;
  mount: (container: HTMLElement, rows: BenchmarkRow[]) => Promise<GridHandle>;
}

export interface GridHandle {
  scrollBy: (deltaY: number) => void;
  editCell: (rowIndex: number, columnId: keyof BenchmarkRow, value: string) => Promise<void>;
  destroy: () => void;
}

export interface BenchmarkConfig {
  scrollFrames: number;
  scrollDeltaPx: number;
}

export const TARGETS = {
  renderMs: 100,
  scrollFps: 60,
  bundleKb: 40,
} as const;
