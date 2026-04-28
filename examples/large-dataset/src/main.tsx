import { Grid, type GridColumnDef, type Row } from '@gridsmith/react';
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const ROW_COUNT = 100_000;

const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 80, pin: 'left', editable: false, sortable: false },
  { id: 'name', header: 'Name', width: 160, type: 'text' },
  { id: 'city', header: 'City', width: 140, type: 'text' },
  {
    id: 'department',
    header: 'Department',
    width: 140,
    type: 'select',
    selectOptions: [
      { label: 'Engineering', value: 'eng' },
      { label: 'Design', value: 'design' },
      { label: 'Sales', value: 'sales' },
      { label: 'Support', value: 'support' },
    ],
  },
  { id: 'salary', header: 'Salary', width: 120, type: 'number' },
  { id: 'tenure', header: 'Tenure (yrs)', width: 120, type: 'number' },
  { id: 'active', header: 'Active', width: 80, type: 'checkbox' },
  { id: 'joined', header: 'Joined', width: 130, type: 'date' },
];

function buildRows(count: number): Row[] {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const cities = ['Seoul', 'Tokyo', 'Osaka', 'Busan', 'Taipei', 'Kyoto', 'Incheon'];
  const departments = ['eng', 'design', 'sales', 'support'];
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) {
    rows[i] = {
      id: i + 1,
      name: names[i % names.length],
      city: cities[i % cities.length],
      department: departments[i % departments.length],
      salary: 50_000 + (i % 50) * 1000,
      tenure: i % 25,
      active: i % 5 !== 0,
      joined: new Date(2010 + (i % 15), i % 12, 1 + (i % 28)),
    };
  }
  return rows;
}

function App() {
  const initial = useMemo(() => buildRows(ROW_COUNT), []);
  const [rows, setRows] = useState<Row[]>(initial);

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
      <h1 style={{ margin: '0 0 0.5rem' }}>Large Dataset</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        {ROW_COUNT.toLocaleString()} synthetic rows rendered with row + column virtualization.
        Scroll, sort, filter, edit — everything stays at 60 fps.
      </p>
      <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <Grid
          data={rows}
          columns={columns}
          rowHeight={32}
          onCellChange={({ row, col, newValue }) => {
            setRows((prev) => {
              const next = [...prev];
              const target = next[row];
              if (!target) return prev;
              next[row] = { ...target, [col]: newValue };
              return next;
            });
          }}
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
