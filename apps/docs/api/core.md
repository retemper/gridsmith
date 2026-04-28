# @gridsmith/core

Headless TypeScript core. No DOM imports outside the renderer module.

## createGrid

```ts
function createGrid(options: GridOptions): GridInstance;

interface GridOptions {
  data: Row[];
  columns: ColumnDef[];
  plugins?: GridPlugin[];
}
```

Creates and initializes a grid instance. Plugins are sorted by dependency order and `init`-ed once.

`GridInstance` exposes:

- `data: readonly Row[]` — current row array (plain, not a signal; mutations go through `setData` / `setCell`).
- `columns: ReadonlySignal<ColumnDef[]>` — flat leaf columns.
- `columnDefs: ReadonlySignal<ColumnDef[]>` — original tree (with `children`).
- `sortState: Signal<SortState>` / `filterState: Signal<FilterState>` — writable.
- `indexMap: Computed<IndexMap>` — view ↔ data row projection.
- `events: EventBus<GridEvents>` — event bus (`on`, `once`, `emit`).
- `subscribe(event, handler) → Unsubscribe` — convenience wrapper.
- `getCell(rowIndex, columnId)` / `setCell(rowIndex, columnId, value)`.
- `setCellByDataIndex(dataIndex, columnId, value)` — bypasses sort/filter view.
- `batchUpdate(fn)` — wraps in transaction; emits one `transaction:end`.
- `setData(rows)` / `setColumns(cols)`.
- `resizeColumn(columnId, width)` / `reorderColumn(fromIndex, toIndex)` — note: reorder takes positional indices, not column ids.
- `pinnedTopRows` / `pinnedBottomRows` (signals) + `setPinnedTopRows` / `setPinnedBottomRows`.
- `rowCount: number` — view-row total (data + pinned).
- `getCellDecorations(row, col)` — cells' merged decorations from all plugins.
- `getPlugin<T>(name): T | undefined`.
- `destroy()`.

## createRenderer

```ts
function createRenderer(): Renderer;

interface Renderer {
  mount(container: HTMLElement, grid: GridInstance): void;
  destroy(): void;
}
```

Mounts a virtualized DOM grid into a container. Subscribes to grid events; updates incrementally on data, sort, filter, and column changes.

## Reactive primitives

```ts
function signal<T>(initial: T): Signal<T>;
function computed<T>(fn: () => T): ReadonlySignal<T>;
function batch(fn: () => void): void;
```

Used internally; safe to use in custom plugins or non-React adapters.

## Plugin creators

| Function                           | What it adds                                  |
| ---------------------------------- | --------------------------------------------- |
| `createEditingPlugin()`            | Cell editors, `defineEditor`, `editable` flag |
| `createSelectionPlugin()`          | Ranges + active cell                          |
| `createClipboardPlugin()`          | TSV + HTML clipboard                          |
| `createHistoryPlugin(options?)`    | Undo / redo with command pattern              |
| `createFillHandlePlugin(options?)` | Drag-fill with pattern recognition            |
| `createValidationPlugin()`         | Sync + async validators                       |
| `createAsyncDataPlugin(options)`   | Server-side data + infinite scroll            |
| `createChangesPlugin()`            | Dirty-cell tracking + commit / revert         |

Each returns a `GridPlugin` ready to pass into `createGrid({ plugins })`.

## Virtualization helpers

```ts
function computeColumnLayout(columns, widths): ColumnLayout;
function calculateVisibleRange(viewport, layout): VisibleRange;
function getTotalHeight(rowCount, config): number;

const DEFAULT_CONFIG: VirtualizationConfig;
```

## Column-tree helpers

```ts
function flattenColumns(tree: ColumnDef[]): ColumnDef[]; // leaves only
function getHeaderDepth(tree: ColumnDef[]): number; // 1 = flat
function buildHeaderRows(tree): HeaderRow[];
function setLeafWidth(tree, columnId, width): ColumnDef[]; // immutable
function columnStructureKey(tree): string;
```

## Accessibility helpers

```ts
function buildCellId(gridId, rowIndex, columnId): string;
function buildPinnedCellId(gridId, position, rowIndex, columnId): string;
function computeRowCount(dataRowCount, pinnedTop, pinnedBottom): number;
function dataRowAriaIndex(viewIndex, pinnedTopCount): number;
function headerRowAriaIndex(headerDepth, groupIndex): number;
function pinnedTopAriaIndex(pinnedIndex): number;
function pinnedBottomAriaIndex(pinnedIndex): number;
function nextGridInstanceId(): string;
function createAnnouncer(): Announcer;
```

The id format produced by `buildCellId` / `buildPinnedCellId` is part of the public contract.

## Plugins

A plugin is:

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

// CellDecorator is the callback shape plugins register via ctx.addCellDecorator.
// See packages/core/src/types.ts for the exact arguments — typically the
// view-row index, column id, and current row snapshot.

interface CellDecoration {
  className?: string;
  attributes?: Record<string, string>;
}
```

Init hooks may return a cleanup function called on `grid.destroy()`.

## Types

See [Types](./types) for `Row`, `CellValue`, `ColumnDef`, plugin state shapes, etc.

## Source

[`packages/core/src/index.ts`](https://github.com/retemper/gridsmith/blob/main/packages/core/src/index.ts)
