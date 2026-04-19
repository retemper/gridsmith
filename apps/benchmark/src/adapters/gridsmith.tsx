import { VERSION, type Row } from '@gridsmith/core';
import { Grid, type GridColumnDef } from '@gridsmith/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { waitForPaint } from '../metrics';
import type { BenchmarkRow, GridAdapter, GridHandle } from '../types';

const COLUMNS: GridColumnDef[] = [
  { id: 'id', header: '#', width: 80, type: 'number', editable: false },
  { id: 'name', header: 'Name', width: 160, type: 'text' },
  { id: 'email', header: 'Email', width: 240, type: 'text' },
  { id: 'age', header: 'Age', width: 80, type: 'number' },
  { id: 'balance', header: 'Balance', width: 120, type: 'number' },
  { id: 'active', header: 'Active', width: 100, type: 'checkbox' },
  { id: 'joined', header: 'Joined', width: 140, type: 'date' },
];

function GridsmithApp({
  rows,
  registerMutate,
}: {
  rows: BenchmarkRow[];
  registerMutate: (
    fn: (rowIndex: number, columnId: keyof BenchmarkRow, value: string) => void,
  ) => void;
}): React.ReactElement {
  const [data, setData] = useState(rows);
  useEffect(() => {
    registerMutate((rowIndex, columnId, value) => {
      setData((prev) => {
        const current = prev[rowIndex];
        if (!current) return prev;
        const next = prev.slice();
        next[rowIndex] = { ...current, [columnId]: value };
        return next;
      });
    });
  }, [registerMutate]);
  return <Grid data={data as unknown as Row[]} columns={COLUMNS} rowHeight={32} />;
}

export const gridsmithAdapter: GridAdapter = {
  id: 'gridsmith',
  label: 'Gridsmith',
  version: VERSION,
  async mount(container: HTMLElement, rows: BenchmarkRow[]): Promise<GridHandle> {
    let mutate: ((rowIndex: number, columnId: keyof BenchmarkRow, value: string) => void) | null =
      null;
    const host = document.createElement('div');
    host.style.cssText = 'width:100%;height:100%;';
    container.appendChild(host);
    const root: Root = createRoot(host);
    root.render(
      <StrictMode>
        <GridsmithApp
          rows={rows}
          registerMutate={(fn) => {
            mutate = fn;
          }}
        />
      </StrictMode>,
    );
    await waitForPaint();
    return {
      scrollBy(deltaY: number): void {
        const viewport = host.querySelector<HTMLElement>('.gs-viewport');
        viewport?.scrollBy(0, deltaY);
      },
      async editCell(rowIndex, columnId, value): Promise<void> {
        mutate?.(rowIndex, columnId, value);
        await waitForPaint();
      },
      destroy(): void {
        root.unmount();
        host.remove();
      },
    };
  },
};
