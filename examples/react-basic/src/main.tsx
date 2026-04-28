import { Grid, type GridColumnDef, type Row } from '@gridsmith/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60, pin: 'left', editable: false, sortable: false },
  { id: 'name', header: 'Name', width: 180, type: 'text' },
  { id: 'price', header: 'Price', width: 120, type: 'number' },
  { id: 'inStock', header: 'In Stock', width: 100, type: 'checkbox' },
  {
    id: 'category',
    header: 'Category',
    width: 140,
    type: 'select',
    selectOptions: [
      { label: 'Coffee', value: 'coffee' },
      { label: 'Tea', value: 'tea' },
      { label: 'Pastry', value: 'pastry' },
    ],
  },
];

const initialRows: Row[] = [
  { id: 1, name: 'Espresso', price: 3.5, inStock: true, category: 'coffee' },
  { id: 2, name: 'Latte', price: 4.5, inStock: true, category: 'coffee' },
  { id: 3, name: 'Mocha', price: 5.0, inStock: false, category: 'coffee' },
  { id: 4, name: 'Earl Grey', price: 3.0, inStock: true, category: 'tea' },
  { id: 5, name: 'Croissant', price: 4.0, inStock: true, category: 'pastry' },
];

function App() {
  const [rows, setRows] = useState<Row[]>(initialRows);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', height: '100vh' }}>
      <h1 style={{ margin: '0 0 0.5rem' }}>Basic Grid</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        A 5-row grid with text / number / checkbox / select editors. Edit, copy, paste, undo all
        work out of the box.
      </p>
      <div
        style={{
          height: 360,
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
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
