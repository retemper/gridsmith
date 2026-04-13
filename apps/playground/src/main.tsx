import { VERSION } from '@gridsmith/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Gridsmith Playground</h1>
      <p>Core version: {VERSION}</p>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: '#94a3b8',
        }}
      >
        Grid will render here
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
