import { VERSION } from '@gridsmith/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Gridsmith React Basic Example</h1>
      <p>Version: {VERSION}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
