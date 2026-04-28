# Getting Started

Gridsmith is a TypeScript data grid built around a headless core (`@gridsmith/core`) and thin framework adapters. This page gets you to a running, editable grid in under a minute.

## Install

```bash
pnpm add @gridsmith/react react react-dom
```

`@gridsmith/react` re-exports everything you'll need from `@gridsmith/core` — you don't need to install both.

For other package managers see [Installation](./installation).

## Your first grid

```tsx
import { Grid, type GridColumnDef, type Row } from '@gridsmith/react';

const columns: GridColumnDef[] = [
  { id: 'name', header: 'Name', width: 160, type: 'text' },
  { id: 'price', header: 'Price', width: 100, type: 'number' },
  { id: 'inStock', header: 'In Stock', width: 100, type: 'checkbox' },
];

const rows: Row[] = [
  { name: 'Espresso', price: 3.5, inStock: true },
  { name: 'Latte', price: 4.5, inStock: true },
  { name: 'Mocha', price: 5.0, inStock: false },
];

export function App() {
  return (
    <div style={{ height: 400 }}>
      <Grid data={rows} columns={columns} />
    </div>
  );
}
```

That's a fully functional grid. Out of the box you get:

- Cell editing — double-click or press `F2` / `Enter`
- Range selection — click + drag, `Shift+Arrow`, `Ctrl/Cmd+A`
- Excel-compatible clipboard — `Ctrl/Cmd+C/X/V`
- Fill handle — drag the dot at the bottom-right of the selection
- Undo / Redo — `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`
- Sort and filter — click headers, open the filter popover
- Column resize / reorder / pin
- Keyboard navigation, IME-safe composition
- WAI-ARIA grid pattern + screen-reader announcements

All of these are auto-registered when you mount `<Grid />`. Drop into individual guides under [Guides](/guides/editing) for details.

## Reacting to edits

```tsx
<Grid
  data={rows}
  columns={columns}
  onCellChange={(change) => {
    // change: { row, col, oldValue, newValue }
    console.log('cell changed', change);
  }}
/>
```

For batch operations and access to plugin APIs, use [`useGrid`](/api/react#usegrid).

## Next steps

- [Core Concepts](./concepts) — how data, columns, plugins, and events fit together.
- [Cell Editing](/guides/editing) — built-in editors and the `editable` flag.
- [Async Data](/guides/async-data) — server-side rows with infinite scroll.
- [Examples](/examples/) — runnable apps you can copy.
