# Core Concepts

Gridsmith is small enough that you can hold its model in your head. This page walks through the four ideas you need to understand the rest of the docs.

## 1. Headless core + thin adapter

```
┌──────────────────────────────────────────────┐
│ @gridsmith/react   (Grid component, hooks)    │
├──────────────────────────────────────────────┤
│ @gridsmith/core    (createGrid, plugins,      │
│                     virtualization, renderer) │
└──────────────────────────────────────────────┘
```

The **core** is framework-agnostic TypeScript. It owns:

- Reactive state (`signal`, `computed`, `batch`)
- Sort / filter / index map
- DOM renderer with row + column virtualization
- The plugin system

The **React adapter** is a thin layer:

- A `<Grid />` component that mounts a core renderer
- Hooks that bridge core signals to React (`useSignalValue`, `useGridSelection`, …)

If you ever want to use the grid outside React (Vue, Solid, Svelte, vanilla), you call `createGrid` and `createRenderer` directly — the same engine, no React imports.

## 2. Data + columns

A grid is `data` (`Row[]`) + `columns` (`ColumnDef[]`).

```ts
type Row = Record<string, CellValue>;
type CellValue = string | number | boolean | Date | null | undefined;

interface ColumnDef {
  id: string; // unique key in each row
  header: string; // display label
  type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  width?: number;
  pin?: 'left' | 'right' | false;
  editable?: boolean;
  validate?: SyncValidator;
  // …
}
```

The full column shape is documented in [API → Types → ColumnDef](/api/types#columndef).

Rows are plain objects. Gridsmith doesn't take ownership of them — write to your state in `onCellChange`, or use the [Change Tracking](/guides/change-tracking) plugin to defer commits.

## 3. Plugins

Every editing feature is a plugin. The React adapter auto-registers a default set:

- `selection` — cell ranges, active cell
- `editing` — built-in editors + `defineEditor`
- `clipboard` — TSV + HTML interop
- `fill-handle` — drag-to-fill
- `history` — undo / redo
- `validation` — sync + async validators

You can register additional plugins (or replace defaults) via the `plugins` prop:

```tsx
import { Grid, createAsyncDataPlugin } from '@gridsmith/react';
import { createChangesPlugin } from '@gridsmith/core';

<Grid
  data={[]}
  columns={columns}
  plugins={[createAsyncDataPlugin({ source: myAsyncSource, pageSize: 50 }), createChangesPlugin()]}
/>;
```

Some plugin creators (`createSelectionPlugin`, `createEditingPlugin`, `createChangesPlugin`) are not re-exported from `@gridsmith/react` — import them from `@gridsmith/core` directly.

Plugins talk to each other through the **event bus** and **plugin context**:

```ts
interface GridPlugin {
  name: string;
  dependencies?: string[];
  init(ctx: PluginContext): (() => void) | void;
}

interface PluginContext {
  grid: GridInstance;
  events: EventBus<GridEvents>;
  getPlugin<T>(name: string): T | undefined;
  expose(name: string, api: object): void;
  addCellDecorator(decorator: CellDecorator): void;
}
```

A plugin can:

- Listen to events (`events.on('selection:change', …)`)
- Expose an API (`ctx.expose('clipboard', { copy, paste })`)
- Decorate cells (`ctx.addCellDecorator(({ rowIndex, columnId }) => ({ className }))`)

See [Plugin System](/api/core#plugins) for the full surface.

## 4. Reactive state and events

Gridsmith uses fine-grained signals internally. You usually don't touch signals — the React adapter wraps them — but it's useful to know what's reactive:

- `data` — the row array
- `columns`, `columnDefs` — flat leaves and the original tree
- `sort`, `filter` — current sort/filter state
- `viewport` — visible row/column range
- Plugin state (selection, edit, history, etc.)

When state changes, the relevant **event** fires on the grid event bus. The `<Grid />` component surfaces the most-used ones as callbacks (`onCellChange`, `onSortChange`, `onFilterChange`, `onColumnResize`, `onColumnReorder`); for the rest, drop into headless mode with `useGrid` + `createRenderer` and subscribe directly. Some events you'll see throughout the docs:

| Event              | When                                          |
| ------------------ | --------------------------------------------- |
| `data:change`      | One or more cells were written.               |
| `selection:change` | Selection or active cell moved.               |
| `edit:commit`      | An edit was committed (passes validation).    |
| `clipboard:paste`  | A paste landed on the grid.                   |
| `history:change`   | Undo/redo stack changed.                      |
| `transaction:end`  | A `batchUpdate` finished — one undoable step. |

The full catalog is in [API → Events](/api/events).

## Putting it together

A typical interaction — a paste — fires this sequence:

1. User hits `Ctrl+V`. The clipboard plugin reads the system clipboard.
2. Clipboard plugin calls `grid.batchUpdate(() => { /* setCell × N */ })`.
3. `transaction:begin` fires.
4. Each `setCell` fires `data:change` (coalesced into one transaction).
5. The validation plugin re-validates the affected cells.
6. The history plugin records one undo entry.
7. `transaction:end` fires. The renderer paints.

Everything you'll read in the guides is built on these four ideas. Next up: [Cell Editing](/guides/editing).
