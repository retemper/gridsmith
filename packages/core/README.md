# @gridsmith/core

> Headless core for the [Gridsmith](https://github.com/retemper/gridsmith) data grid — state, editing engine, virtualization. Framework-agnostic.

[![npm](https://img.shields.io/npm/v/@gridsmith/core.svg)](https://www.npmjs.com/package/@gridsmith/core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/retemper/gridsmith/blob/main/LICENSE)

## Install

```bash
pnpm add @gridsmith/core
```

## What's in the box

- **`createGrid(options)`** — reactive grid instance with signals, plugin host, event bus, and sort/filter index map
- **`createRenderer(options)`** — DOM renderer with row + column virtualization
- **Editing plugins** — `createEditingPlugin`, `createSelectionPlugin`, `createClipboardPlugin` (TSV + HTML), `createFillHandlePlugin`, `createHistoryPlugin` (Command pattern undo/redo), `createValidationPlugin` (sync + async)
- **Data plugins** — `createAsyncDataPlugin` (infinite scroll, page-keyed dedupe, abortable fetches), `createChangesPlugin` (dirty tracking, batch commit/revert)
- **Layout helpers** — multi-level group headers (`flattenColumns`, `buildHeaderRows`), virtualization primitives (`computeColumnLayout`, `calculateVisibleRange`)
- **A11y helpers** — WAI-ARIA grid pattern utilities and a screen-reader announcer

## Vanilla example

```ts
import { createGrid, createRenderer, createEditingPlugin } from '@gridsmith/core';

const grid = createGrid({
  data: [
    { name: 'Aria', price: 12 },
    { name: 'Beam', price: 34 },
  ],
  columns: [
    { id: 'name', header: 'Name', editor: 'text' },
    { id: 'price', header: 'Price', editor: 'number' },
  ],
  plugins: [createEditingPlugin()],
});

createRenderer({ grid, container: document.getElementById('grid')! });
```

If you're using React, reach for [`@gridsmith/react`](https://www.npmjs.com/package/@gridsmith/react) instead — it wires the renderer and plugins into a `<Grid />` component for you.

## Docs

- Documentation: <https://retemper.github.io/gridsmith/>
- API reference: <https://retemper.github.io/gridsmith/api/core>
- Source: <https://github.com/retemper/gridsmith>

## License

MIT © retemper
