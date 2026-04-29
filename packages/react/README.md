# @gridsmith/react

> React adapter for [Gridsmith](https://github.com/retemper/gridsmith) — Excel-grade editing in a single `<Grid />` component.

[![npm](https://img.shields.io/npm/v/@gridsmith/react.svg)](https://www.npmjs.com/package/@gridsmith/react)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/retemper/gridsmith/blob/main/LICENSE)

## Install

```bash
pnpm add @gridsmith/react
```

Peer deps: `react >=18` and `react-dom >=18`. The adapter installs `@gridsmith/core` automatically.

## Quick start

```tsx
import { Grid } from '@gridsmith/react';

const rows = [
  { name: 'Aria', price: 12 },
  { name: 'Beam', price: 34 },
];

const columns = [
  { id: 'name', header: 'Name', editor: 'text' as const },
  { id: 'price', header: 'Price', editor: 'number' as const },
];

export function App() {
  return <Grid data={rows} columns={columns} />;
}
```

## What you get out of the box

- **Editing** — text / number / select / checkbox / date editors, custom editors via `defineEditor`, double-click / F2 / type-to-edit, Enter/Esc/Tab semantics
- **Selection & keyboard nav** — single + multi-range, row/column select, full arrow / Tab / Home/End / PageUp/PageDown, IME-safe composition
- **Clipboard** — Excel-compatible TSV + HTML copy/paste/cut, multi-range
- **Fill handle** — Excel-style pattern detection (numbers, dates, sequences)
- **Undo/Redo** — Command pattern with batch grouping
- **Validation** — sync + async validators with visual error markers
- **Sort / filter** — controlled or uncontrolled
- **Columns** — resize, reorder, pin (left/right), multi-level group headers
- **Rows** — top/bottom pinning, fixed-height row virtualization
- **Async data** — infinite scroll plugin with page dedupe and AbortSignal
- **A11y** — WAI-ARIA 1.2 grid pattern + screen-reader announcements

## Hooks

For headless control alongside `<Grid />`:

```tsx
import { useGrid, useGridSelection, useGridClipboard } from '@gridsmith/react';
```

`useGrid`, `useGridSelection`, `useGridClipboard`, `useGridFillHandle`, `useGridValidation`, `useSignalValue`.

## Custom cells

```tsx
const columns = [
  {
    id: 'price',
    header: 'Price',
    cellRenderer: ({ value }) => <strong>${value}</strong>,
  },
];
```

For deeper customization, write a plugin against `@gridsmith/core` and pass it via `<Grid plugins={[...]} />`.

## Docs

- Getting started: <https://retemper.github.io/gridsmith/guide/getting-started>
- API reference: <https://retemper.github.io/gridsmith/api/react>
- Examples: <https://github.com/retemper/gridsmith/tree/main/examples>
- Source: <https://github.com/retemper/gridsmith>

## License

MIT © retemper
