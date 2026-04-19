import '@glideapps/glide-data-grid/dist/index.css';
import {
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type GridCell,
  type GridColumn,
  type Item,
} from '@glideapps/glide-data-grid';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { waitForPaint } from '../metrics';
import type { BenchmarkRow, GridAdapter, GridHandle } from '../types';

const COLUMNS: GridColumn[] = [
  { id: 'id', title: '#', width: 80 },
  { id: 'name', title: 'Name', width: 160 },
  { id: 'email', title: 'Email', width: 240 },
  { id: 'age', title: 'Age', width: 80 },
  { id: 'balance', title: 'Balance', width: 120 },
  { id: 'active', title: 'Active', width: 100 },
  { id: 'joined', title: 'Joined', width: 140 },
];

const COLUMN_ORDER: (keyof BenchmarkRow)[] = [
  'id',
  'name',
  'email',
  'age',
  'balance',
  'active',
  'joined',
];

function makeCell(row: BenchmarkRow, columnId: keyof BenchmarkRow): GridCell {
  const value = row[columnId];
  if (columnId === 'active') {
    return { kind: GridCellKind.Boolean, data: Boolean(value), allowOverlay: false };
  }
  if (columnId === 'id' || columnId === 'age' || columnId === 'balance') {
    return {
      kind: GridCellKind.Number,
      data: Number(value),
      displayData: String(value),
      allowOverlay: true,
    };
  }
  return {
    kind: GridCellKind.Text,
    data: String(value),
    displayData: String(value),
    allowOverlay: true,
  };
}

export const glideAdapter: GridAdapter = {
  id: 'glide',
  label: 'Glide Data Grid',
  version: '6.x',
  async mount(container: HTMLElement, rows: BenchmarkRow[]): Promise<GridHandle> {
    const editorRef = createRef<DataEditorRef>();
    const data = rows.map((r) => ({ ...r }));
    const host = document.createElement('div');
    host.style.cssText = 'width:100%;height:100%;';
    container.appendChild(host);
    const root: Root = createRoot(host);
    const EMPTY_CELL: GridCell = {
      kind: GridCellKind.Text,
      data: '',
      displayData: '',
      allowOverlay: false,
    };
    const getCellContent = (cell: Item): GridCell => {
      const [col, row] = cell;
      const columnId = COLUMN_ORDER[col];
      const rowData = data[row];
      if (!columnId || !rowData) return EMPTY_CELL;
      return makeCell(rowData, columnId);
    };
    root.render(
      <DataEditor
        ref={editorRef}
        getCellContent={getCellContent}
        columns={COLUMNS}
        rows={data.length}
        rowHeight={32}
        headerHeight={36}
        width="100%"
        height="100%"
      />,
    );
    await waitForPaint();
    await waitForPaint();
    return {
      scrollBy(deltaY: number): void {
        const scroller = host.querySelector<HTMLElement>('.dvn-scroller');
        scroller?.scrollBy(0, deltaY);
      },
      async editCell(rowIndex, columnId, value): Promise<void> {
        const row = data[rowIndex];
        if (!row) return;
        data[rowIndex] = { ...row, [columnId]: value };
        const colIdx = COLUMN_ORDER.indexOf(columnId);
        editorRef.current?.updateCells([{ cell: [colIdx, rowIndex] }]);
        await waitForPaint();
      },
      destroy(): void {
        root.unmount();
        host.remove();
      },
    };
  },
};
