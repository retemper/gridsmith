import { Grid, type CellValue, type GridColumnDef, type Row } from '@gridsmith/react';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const COLOR_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899'];

interface ColorEditorProps {
  value: CellValue;
  commit: (value: CellValue) => void;
  cancel: () => void;
}

function ColorEditor({ value, commit, cancel }: ColorEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel();
      }}
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'white',
        border: '2px solid #2563eb',
        outline: 'none',
        height: '100%',
        alignItems: 'center',
      }}
    >
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => commit(color)}
          aria-label={`Pick ${color}`}
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: color === value ? '2px solid #1e293b' : '1px solid #cbd5e1',
            background: color,
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}

const columns: GridColumnDef[] = [
  { id: 'id', header: '#', width: 60, pin: 'left', editable: false, sortable: false },
  { id: 'name', header: 'Tag', width: 200, type: 'text' },
  {
    id: 'color',
    header: 'Color',
    width: 220,
    cellEditor: ({ value, commit, cancel }) => (
      <ColorEditor value={value} commit={commit} cancel={cancel} />
    ),
    cellRenderer: ({ value }) => {
      const color = typeof value === 'string' ? value : '';
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: color || 'transparent',
              border: '1px solid #cbd5e1',
            }}
          />
          <code style={{ fontSize: 12 }}>{color}</code>
        </span>
      );
    },
  },
];

const initialRows: Row[] = [
  { id: 1, name: 'urgent', color: '#ef4444' },
  { id: 2, name: 'in-progress', color: '#eab308' },
  { id: 3, name: 'done', color: '#22c55e' },
  { id: 4, name: 'review', color: '#0ea5e9' },
];

function App() {
  const [rows, setRows] = useState<Row[]>(initialRows);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', height: '100vh' }}>
      <h1 style={{ margin: '0 0 0.5rem' }}>Custom Editor</h1>
      <p style={{ margin: '0 0 1rem', color: '#64748b' }}>
        Custom React editor for the Color column — opens a 7-color palette on edit. Click a swatch
        to commit, press <kbd>Esc</kbd> to cancel. The Tag column uses the built-in text editor.
      </p>
      <div style={{ height: 280, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <Grid
          data={rows}
          columns={columns}
          rowHeight={36}
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
