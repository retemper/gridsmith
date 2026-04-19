import { useEffect, useRef, useState } from 'react';

import { agGridAdapter } from './adapters/ag-grid';
import { glideAdapter } from './adapters/glide';
import { gridsmithAdapter } from './adapters/gridsmith';
import { handsontableAdapter } from './adapters/handsontable';
import { generateRows } from './data';
import { runBenchmark } from './runner';
import { TARGETS, type GridAdapter, type GridId, type MetricResult } from './types';

const ADAPTERS: GridAdapter[] = [
  gridsmithAdapter,
  agGridAdapter,
  handsontableAdapter,
  glideAdapter,
];

const ROW_CHOICES = [10_000, 100_000, 1_000_000];
const DEFAULT_ROWS = 1_000_000;

type Results = Partial<Record<GridId, MetricResult>>;

interface BundleSizeMap {
  [key: string]: number;
}

export function App(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowCount, setRowCount] = useState<number>(DEFAULT_ROWS);
  const [status, setStatus] = useState<string>('idle');
  const [busy, setBusy] = useState<boolean>(false);
  const [results, setResults] = useState<Results>({});
  const [bundleSizes, setBundleSizes] = useState<BundleSizeMap>({});

  useEffect(() => {
    fetch('/bundle-sizes.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: BundleSizeMap) => setBundleSizes(data))
      .catch(() => setBundleSizes({}));
  }, []);

  async function runAll(): Promise<void> {
    if (busy || !containerRef.current) return;
    setBusy(true);
    try {
      setResults({});
      setStatus(`generating ${rowCount.toLocaleString()} rows…`);
      const rows = generateRows(rowCount);
      for (const adapter of ADAPTERS) {
        setStatus(`${adapter.label}: running…`);
        try {
          const result = await runBenchmark(adapter, containerRef.current, rows, {
            scrollFrames: 120,
            scrollDeltaPx: 64,
          });
          setResults((prev) => ({
            ...prev,
            [adapter.id]: {
              ...result,
              bundleKb: bundleSizes[adapter.id] ?? null,
            },
          }));
        } catch (err) {
          console.error(`[${adapter.label}]`, err);
          setResults((prev) => ({
            ...prev,
            [adapter.id]: {
              renderMs: null,
              scrollFps: null,
              editLatencyMs: null,
              memoryMb: null,
              bundleKb: bundleSizes[adapter.id] ?? null,
            },
          }));
        }
      }
      setStatus('done');
    } finally {
      setBusy(false);
    }
  }

  async function runOne(adapter: GridAdapter): Promise<void> {
    if (busy || !containerRef.current) return;
    setBusy(true);
    try {
      setStatus(`${adapter.label}: generating ${rowCount.toLocaleString()} rows…`);
      const rows = generateRows(rowCount);
      setStatus(`${adapter.label}: running…`);
      const result = await runBenchmark(adapter, containerRef.current, rows, {
        scrollFrames: 120,
        scrollDeltaPx: 64,
      });
      setResults((prev) => ({
        ...prev,
        [adapter.id]: {
          ...result,
          bundleKb: bundleSizes[adapter.id] ?? null,
        },
      }));
      setStatus('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Gridsmith Benchmark</h1>
        <p className="subtitle">1M-row comparison</p>

        <label className="field">
          <span>Row count</span>
          <select
            value={rowCount}
            onChange={(e) => {
              setRowCount(Number(e.target.value));
            }}
          >
            {ROW_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>

        <button className="primary" onClick={runAll} disabled={busy}>
          Run all
        </button>

        <ul className="runners">
          {ADAPTERS.map((adapter) => (
            <li key={adapter.id}>
              <button onClick={() => runOne(adapter)} disabled={busy}>
                Run {adapter.label}
              </button>
            </li>
          ))}
        </ul>

        <p className="status">{status}</p>

        <section className="targets">
          <h2>Targets</h2>
          <ul>
            <li>Render: &lt; {TARGETS.renderMs}ms</li>
            <li>Scroll: ≥ {TARGETS.scrollFps}fps</li>
            <li>Bundle: &lt; {TARGETS.bundleKb}KB gzip</li>
          </ul>
        </section>
      </aside>

      <main className="main">
        <ResultsTable adapters={ADAPTERS} results={results} />
        <div className="grid-host" ref={containerRef} />
      </main>
    </div>
  );
}

function ResultsTable({
  adapters,
  results,
}: {
  adapters: GridAdapter[];
  results: Results;
}): React.ReactElement {
  const maxRender = max(adapters, (a) => results[a.id]?.renderMs);
  const maxFps = max(adapters, (a) => results[a.id]?.scrollFps);
  const maxEdit = max(adapters, (a) => results[a.id]?.editLatencyMs);
  const maxMem = max(adapters, (a) => results[a.id]?.memoryMb);
  const maxBundle = max(adapters, (a) => results[a.id]?.bundleKb);

  return (
    <table className="results">
      <thead>
        <tr>
          <th>Grid</th>
          <th>Render (ms)</th>
          <th>Scroll (fps)</th>
          <th>Edit (ms)</th>
          <th>Memory (MB)</th>
          <th>Bundle (KB gzip)</th>
        </tr>
      </thead>
      <tbody>
        {adapters.map((a) => {
          const r = results[a.id];
          return (
            <tr key={a.id} className={a.id === 'gridsmith' ? 'highlight' : undefined}>
              <th scope="row">
                {a.label} <span className="version">{a.version}</span>
              </th>
              <MetricCell
                value={r?.renderMs}
                max={maxRender}
                format={(v) => v.toFixed(1)}
                pass={r?.renderMs != null && r.renderMs < TARGETS.renderMs}
                invert
              />
              <MetricCell
                value={r?.scrollFps}
                max={maxFps}
                format={(v) => v.toFixed(1)}
                pass={r?.scrollFps != null && r.scrollFps >= TARGETS.scrollFps}
              />
              <MetricCell
                value={r?.editLatencyMs}
                max={maxEdit}
                format={(v) => v.toFixed(1)}
                invert
              />
              <MetricCell value={r?.memoryMb} max={maxMem} format={(v) => v.toFixed(1)} invert />
              <MetricCell
                value={r?.bundleKb}
                max={maxBundle}
                format={(v) => v.toFixed(1)}
                pass={a.id === 'gridsmith' && r?.bundleKb != null && r.bundleKb < TARGETS.bundleKb}
                invert
              />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MetricCell({
  value,
  max,
  format,
  pass,
  invert,
}: {
  value: number | null | undefined;
  max: number;
  format: (v: number) => string;
  pass?: boolean;
  invert?: boolean;
}): React.ReactElement {
  if (value == null) return <td className="empty">—</td>;
  const pct = max > 0 ? (value / max) * 100 : 0;
  const widthPct = invert ? Math.max(5, 100 - pct + 5) : Math.max(5, pct);
  return (
    <td className={pass ? 'pass' : undefined}>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${widthPct}%` }} />
        <span className="bar-value">{format(value)}</span>
      </div>
    </td>
  );
}

function max(adapters: GridAdapter[], pick: (a: GridAdapter) => number | null | undefined): number {
  let m = 0;
  for (const a of adapters) {
    const v = pick(a);
    if (v != null && v > m) m = v;
  }
  return m;
}
