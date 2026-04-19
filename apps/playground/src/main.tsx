import { VERSION } from '@gridsmith/core';
import {
  Grid,
  createAsyncDataPlugin,
  type AsyncDataSource,
  type GridColumnDef,
  type Row,
  type SortState,
  type FilterState,
} from '@gridsmith/react';
import { StrictMode, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const sampleColumns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60, pin: 'left', editable: false, sortable: false },
  {
    id: 'name',
    header: 'Name',
    width: 150,
    type: 'text',
    validate: (v) => (typeof v === 'string' && v.length > 0) || 'Name is required',
  },
  {
    id: 'age',
    header: 'Age',
    width: 80,
    type: 'number',
    validationMode: 'warn',
    validate: (v) => (typeof v === 'number' && v >= 0 && v < 150) || 'Age must be 0–149',
  },
  { id: 'city', header: 'City', width: 120, type: 'text' },
  {
    id: 'department',
    header: 'Department',
    width: 140,
    type: 'select',
    selectOptions: [
      { label: 'Engineering', value: 'eng' },
      { label: 'Design', value: 'design' },
      { label: 'Marketing', value: 'marketing' },
      { label: 'Sales', value: 'sales' },
    ],
  },
  { id: 'active', header: 'Active', width: 80, type: 'checkbox' },
  { id: 'joined', header: 'Joined', width: 120, type: 'date' },
  { id: 'actions', header: 'Actions', width: 80, pin: 'right', editable: false, resizable: false },
];

const sampleData: Row[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'][i % 8],
  age: 25 + (i % 20),
  city: ['Seoul', 'Tokyo', 'Osaka', 'Busan', 'Taipei'][i % 5],
  department: ['eng', 'design', 'marketing', 'sales'][i % 4],
  active: i % 3 !== 0,
  joined: new Date(2020 + (i % 5), i % 12, 1 + (i % 28)),
}));

const ASYNC_TOTAL = 10_000;
const ASYNC_LATENCY_MS = 400;

function makeRemoteRow(i: number): Row {
  return {
    id: i + 1,
    name: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'][i % 8],
    age: 20 + (i % 50),
    city: ['Seoul', 'Tokyo', 'Osaka', 'Busan', 'Taipei', 'Kyoto', 'Incheon'][i % 7],
    department: ['eng', 'design', 'marketing', 'sales'][i % 4],
    active: i % 3 !== 0,
    joined: new Date(2015 + (i % 10), i % 12, 1 + (i % 28)),
  };
}

/**
 * Simulated server. `getRowCount` returns the filtered total; `getRows` sleeps
 * for a fixed latency and honors AbortSignal so sort/filter invalidations can
 * cancel in-flight requests.
 */
function createMockAsyncSource(): AsyncDataSource {
  const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

  return {
    async getRowCount({ filter, signal } = {}) {
      await wait(ASYNC_LATENCY_MS / 2, signal);
      // Toy filter semantics for the demo: any `contains` filter halves the
      // total so the reset-on-filter path is visibly exercised.
      if (filter && filter.length > 0) return Math.floor(ASYNC_TOTAL / 2);
      return ASYNC_TOTAL;
    },

    async getRows({ start, end, sort, signal }) {
      await wait(ASYNC_LATENCY_MS, signal);
      const rows: Row[] = [];
      for (let i = start; i < end; i++) rows.push(makeRemoteRow(i));

      // Demo-only server-side sort: re-sort the page window locally so users
      // can see the `serverSideSort` path exercised. A real server would sort
      // across the whole table, not a single page.
      if (sort && sort.length > 0) {
        const first = sort[0];
        if (first) {
          rows.sort((a, b) => {
            const av = a[first.columnId];
            const bv = b[first.columnId];
            if (av == null && bv == null) return 0;
            if (av == null) return -1;
            if (bv == null) return 1;
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return first.direction === 'desc' ? -cmp : cmp;
          });
        }
      }

      return rows;
    },
  };
}

function App() {
  const [mode, setMode] = useState<'sync' | 'async'>('sync');
  const [sortState, setSortState] = useState<SortState>([]);
  const [filterState, setFilterState] = useState<FilterState>([]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    console.log(`Column ${columnId} resized to ${width}px`);
  }, []);

  const handleColumnReorder = useCallback((columnId: string, from: number, to: number) => {
    console.log(`Column ${columnId} moved from ${from} to ${to}`);
  }, []);

  // Create the async plugin once per mode switch. `AsyncDataSource` is cheap
  // to allocate, but re-creating the plugin on every render would bounce the
  // grid through `destroy → init` on each keystroke.
  const asyncPlugins = useMemo(
    () => [createAsyncDataPlugin({ source: createMockAsyncSource(), pageSize: 50 })],
    [],
  );

  const isAsync = mode === 'async';

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
      <h1 style={{ margin: '0 0 0.5rem' }}>Gridsmith Playground</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        v{VERSION} — Switch between local and async data. In async mode the grid starts with 10,000
        placeholder rows and fetches visible pages on scroll (400ms simulated latency).
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setMode('sync')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: mode === 'sync' ? '#1e293b' : 'white',
            color: mode === 'sync' ? 'white' : '#1e293b',
            cursor: 'pointer',
          }}
        >
          Local (100 rows)
        </button>
        <button
          type="button"
          onClick={() => setMode('async')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: mode === 'async' ? '#1e293b' : 'white',
            color: mode === 'async' ? 'white' : '#1e293b',
            cursor: 'pointer',
          }}
        >
          Async ({ASYNC_TOTAL.toLocaleString()} rows)
        </button>
      </div>
      <div
        style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}
      >
        {isAsync ? (
          <Grid
            key="async"
            data={[]}
            columns={sampleColumns}
            plugins={asyncPlugins}
            rowHeight={36}
            headerHeight={40}
            sortState={sortState}
            filterState={filterState}
            onSortChange={setSortState}
            onFilterChange={setFilterState}
            onColumnResize={handleColumnResize}
            onColumnReorder={handleColumnReorder}
          />
        ) : (
          <Grid
            key="sync"
            data={sampleData}
            columns={sampleColumns}
            rowHeight={36}
            headerHeight={40}
            sortState={sortState}
            filterState={filterState}
            pinnedTopRows={[0, 1]}
            pinnedBottomRows={[99]}
            onSortChange={setSortState}
            onFilterChange={setFilterState}
            onColumnResize={handleColumnResize}
            onColumnReorder={handleColumnReorder}
          />
        )}
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
