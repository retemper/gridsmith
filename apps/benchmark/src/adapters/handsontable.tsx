import 'handsontable/dist/handsontable.full.min.css';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import { createRef, type ComponentRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { waitForPaint } from '../metrics';
import type { BenchmarkRow, GridAdapter, GridHandle } from '../types';

registerAllModules();

const COLUMNS = [
  { data: 'id', title: '#', width: 80, readOnly: true },
  { data: 'name', title: 'Name', width: 160 },
  { data: 'email', title: 'Email', width: 240 },
  { data: 'age', title: 'Age', width: 80, type: 'numeric' },
  { data: 'balance', title: 'Balance', width: 120, type: 'numeric' },
  { data: 'active', title: 'Active', width: 100, type: 'checkbox' },
  { data: 'joined', title: 'Joined', width: 140 },
];

const COLUMN_INDEX: Record<keyof BenchmarkRow, number> = {
  id: 0,
  name: 1,
  email: 2,
  age: 3,
  balance: 4,
  active: 5,
  joined: 6,
};

export const handsontableAdapter: GridAdapter = {
  id: 'handsontable',
  label: 'Handsontable',
  version: '14.x',
  async mount(container: HTMLElement, rows: BenchmarkRow[]): Promise<GridHandle> {
    const hotRef = createRef<ComponentRef<typeof HotTable>>();
    const host = document.createElement('div');
    host.style.cssText = 'width:100%;height:100%;overflow:hidden;';
    container.appendChild(host);
    const root: Root = createRoot(host);
    root.render(
      <HotTable
        ref={hotRef}
        data={rows}
        columns={COLUMNS}
        rowHeights={32}
        colHeaders={true}
        height="100%"
        width="100%"
        licenseKey="non-commercial-and-evaluation"
      />,
    );
    await waitForPaint();
    await waitForPaint();
    return {
      scrollBy(deltaY: number): void {
        const viewport = host.querySelector<HTMLElement>('.wtHolder');
        viewport?.scrollBy(0, deltaY);
      },
      async editCell(rowIndex, columnId, value): Promise<void> {
        const hot = hotRef.current?.hotInstance;
        hot?.setDataAtCell(rowIndex, COLUMN_INDEX[columnId], value);
        await waitForPaint();
      },
      destroy(): void {
        root.unmount();
        host.remove();
      },
    };
  },
};
