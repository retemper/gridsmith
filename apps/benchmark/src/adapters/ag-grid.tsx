import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import type { ColDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createRoot, type Root } from 'react-dom/client';

import { waitForPaint } from '../metrics';
import type { BenchmarkRow, GridAdapter, GridHandle } from '../types';

const COLUMN_DEFS: ColDef<BenchmarkRow>[] = [
  { field: 'id', headerName: '#', width: 80, editable: false },
  { field: 'name', headerName: 'Name', width: 160, editable: true },
  { field: 'email', headerName: 'Email', width: 240 },
  { field: 'age', headerName: 'Age', width: 80 },
  { field: 'balance', headerName: 'Balance', width: 120 },
  { field: 'active', headerName: 'Active', width: 100 },
  { field: 'joined', headerName: 'Joined', width: 140 },
];

export const agGridAdapter: GridAdapter = {
  id: 'ag-grid',
  label: 'AG Grid',
  version: '32.x',
  async mount(container: HTMLElement, rows: BenchmarkRow[]): Promise<GridHandle> {
    let api: GridApi<BenchmarkRow> | null = null;
    const host = document.createElement('div');
    host.className = 'ag-theme-quartz';
    host.style.cssText = 'width:100%;height:100%;';
    container.appendChild(host);
    const root: Root = createRoot(host);
    root.render(
      <AgGridReact<BenchmarkRow>
        rowData={rows}
        columnDefs={COLUMN_DEFS}
        rowHeight={32}
        headerHeight={36}
        onGridReady={(event) => {
          api = event.api;
        }}
      />,
    );
    await waitForPaint();
    await waitForPaint();
    return {
      scrollBy(deltaY: number): void {
        const viewport = host.querySelector<HTMLElement>('.ag-body-viewport');
        viewport?.scrollBy(0, deltaY);
      },
      async editCell(rowIndex, columnId, value): Promise<void> {
        const node = api?.getDisplayedRowAtIndex(rowIndex);
        node?.setDataValue(columnId as string, value);
        await waitForPaint();
      },
      destroy(): void {
        root.unmount();
        host.remove();
      },
    };
  },
};
