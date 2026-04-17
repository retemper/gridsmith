import { VERSION } from '@gridsmith/core';
import {
  Grid,
  type GridColumnDef,
  type Row,
  type SortState,
  type FilterState,
} from '@gridsmith/react';
import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';

const sampleColumns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60, pin: 'left', editable: false, sortable: false },
  { id: 'name', header: 'Name', width: 150, type: 'text' },
  { id: 'age', header: 'Age', width: 80, type: 'number' },
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

function App() {
  const [sortState, setSortState] = useState<SortState>([]);
  const [filterState, setFilterState] = useState<FilterState>([]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    console.log(`Column ${columnId} resized to ${width}px`);
  }, []);

  const handleColumnReorder = useCallback((columnId: string, from: number, to: number) => {
    console.log(`Column ${columnId} moved from ${from} to ${to}`);
  }, []);

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
        v{VERSION} — Drag column borders to resize, drag headers to reorder. # and Actions columns
        are pinned. Rows 0, 1 pinned to top.
      </p>
      <div
        style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}
      >
        <Grid
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
