import { Grid, type GridColumnDef, type Row } from '@gridsmith/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60, pin: 'left', editable: false, sortable: false },
  {
    id: 'name',
    header: 'Name',
    width: 180,
    type: 'text',
    validate: (v) => (typeof v === 'string' && v.length > 0) || 'Name is required',
  },
  {
    id: 'email',
    header: 'Email',
    width: 220,
    type: 'text',
    validate: (v) =>
      typeof v === 'string' && /\S+@\S+\.\S+/.test(v) ? true : 'Invalid email format',
  },
  {
    id: 'age',
    header: 'Age',
    width: 100,
    type: 'number',
    validationMode: 'warn',
    validate: (v) => (typeof v === 'number' && v >= 0 && v < 150) || 'Age must be 0–149',
  },
  {
    id: 'role',
    header: 'Role',
    width: 140,
    type: 'select',
    selectOptions: [
      { label: 'Admin', value: 'admin' },
      { label: 'Member', value: 'member' },
      { label: 'Guest', value: 'guest' },
    ],
  },
  { id: 'active', header: 'Active', width: 80, type: 'checkbox' },
];

const initialRows: Row[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin', active: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', age: 25, role: 'member', active: true },
  { id: 3, name: 'Charlie', email: 'invalid-email', age: 200, role: 'guest', active: false },
];

function App() {
  const [rows, setRows] = useState<Row[]>(initialRows);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', height: '100vh' }}>
      <h1 style={{ margin: '0 0 0.5rem' }}>Editing & Validation</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        Built-in editors with sync validators. The third row has invalid data — try clicking into
        the email and age cells. <strong>Reject mode</strong> on email blocks bad commits;{' '}
        <strong>warn mode</strong> on age commits but flags the cell.
      </p>
      <div style={{ height: 320, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <Grid
          data={rows}
          columns={columns}
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
