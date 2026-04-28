import {
  Grid,
  createAsyncDataPlugin,
  type AsyncDataSource,
  type GridColumnDef,
  type Row,
} from '@gridsmith/react';
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

const TOTAL = 50_000;
const LATENCY_MS = 350;

const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 80, pin: 'left', editable: false, sortable: false },
  { id: 'name', header: 'Name', width: 160, type: 'text' },
  { id: 'city', header: 'City', width: 140, type: 'text' },
  { id: 'salary', header: 'Salary', width: 120, type: 'number' },
  { id: 'active', header: 'Active', width: 80, type: 'checkbox' },
];

function buildRow(i: number): Row {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const cities = ['Seoul', 'Tokyo', 'Osaka', 'Busan', 'Taipei'];
  return {
    id: i + 1,
    name: names[i % names.length],
    city: cities[i % cities.length],
    salary: 40_000 + (i % 100) * 500,
    active: i % 4 !== 0,
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function createMockSource(): AsyncDataSource {
  return {
    async getRowCount({ signal } = {}) {
      await wait(LATENCY_MS / 2, signal);
      return TOTAL;
    },
    async getRows({ start, end, signal }) {
      await wait(LATENCY_MS, signal);
      const rows: Row[] = [];
      for (let i = start; i < end; i++) rows.push(buildRow(i));
      return rows;
    },
  };
}

function App() {
  const plugins = useMemo(
    () => [createAsyncDataPlugin({ source: createMockSource(), pageSize: 100 })],
    [],
  );

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'system-ui',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h1 style={{ margin: '0 0 0.5rem' }}>Async Data</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        {TOTAL.toLocaleString()} rows from a simulated server (350 ms page latency). Visible windows
        fetch on scroll. Loading rows shimmer until they arrive.
      </p>
      <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <Grid data={[]} columns={columns} plugins={plugins} rowHeight={32} />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
