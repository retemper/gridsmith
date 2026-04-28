# @gridsmith/react

The React adapter. Re-exports the core public types and most plugin creators (`createAsyncDataPlugin`, `createClipboardPlugin`, `createEditingPlugin`, `createFillHandlePlugin`, `createHistoryPlugin`, `createValidationPlugin`). For symbols not re-exported (e.g. `createSelectionPlugin`, `createChangesPlugin`, `createRenderer`, signals, virtualization helpers), import from `@gridsmith/core` directly.

## &lt;Grid /&gt;

```ts
interface GridProps {
  data: Row[];
  columns: GridColumnDef[];
  plugins?: GridPlugin[];

  rowHeight?: number; // default 32
  headerHeight?: number; // default rowHeight
  overscan?: number; // default 3
  defaultColumnWidth?: number; // default 100
  className?: string;

  sortState?: SortState; // controlled when set
  filterState?: FilterState; // controlled when set

  pinnedTopRows?: number[];
  pinnedBottomRows?: number[];

  onCellChange?: (change: CellChange) => void;
  onSortChange?: (sort: SortState) => void;
  onFilterChange?: (filter: FilterState) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columnId: string, fromIndex: number, toIndex: number) => void;
}
```

The `<Grid />` component creates and owns its own `GridInstance` internally. Auto-registers `editing`, `selection`, `clipboard`, `history`, `fill-handle`, `validation`. Additional plugins via the `plugins` prop are appended to the built-in set.

`sortState` and `filterState` are **controlled** when set — pair with `onSortChange` / `onFilterChange`. Omit for uncontrolled defaults.

## Headless mode

For non-default rendering, custom layouts, or programmatic plugin-API access, use `useGrid` directly with `createRenderer`:

```tsx
import { useGrid, useGridSelection } from '@gridsmith/react';
import { createRenderer } from '@gridsmith/core';

function HeadlessGrid({ data, columns }: { data: Row[]; columns: GridColumnDef[] }) {
  const grid = useGrid({ data, columns });
  const ref = useRef<HTMLDivElement>(null);
  const { activeCell } = useGridSelection(grid);

  useEffect(() => {
    if (!ref.current) return;
    const renderer = createRenderer();
    renderer.mount(ref.current, grid);
    return () => renderer.destroy();
  }, [grid]);

  return <div ref={ref} style={{ height: 400 }} />;
}
```

In this mode, every `useGridX(grid)` hook is available against your grid instance.

## useGrid

```ts
function useGrid(options: UseGridOptions): GridInstance;

type UseGridOptions = {
  data: Row[];
  columns: GridColumnDef[];
  plugins?: GridPlugin[];
};
```

Creates a headless grid via `createGrid` once (via `useState`) and syncs `data` / `columns` props on change. Strips React-specific column fields (`cellRenderer`, `cellEditor`) before passing to the core.

## useSignalValue

```ts
function useSignalValue<T>(signal: ReadonlySignal<T>): T;
```

Subscribe a React component to a core signal. Re-renders on change.

## Plugin accessor hooks

Each returns the plugin's API or `null` if not registered.

| Hook                      | Returns                       |
| ------------------------- | ----------------------------- |
| `useGridSelection(grid)`  | `SelectionState`              |
| `useGridClipboard(grid)`  | `ClipboardPluginApi \| null`  |
| `useGridFillHandle(grid)` | `FillHandlePluginApi \| null` |
| `useGridValidation(grid)` | `ValidationPluginApi \| null` |

`useGridSelection` returns a snapshot via `useSyncExternalStore`, so it composes with other React state.

## Live-region announcements

`<Grid />` mounts polite/assertive live regions internally and wires grid events to them automatically — no extra hook required. For non-React adapters, the lower-level `createAnnouncer()` is exported from `@gridsmith/core`.

## React-extended types

```ts
interface GridColumnDef extends Omit<ColumnDef, 'children'> {
  cellRenderer?: (props: CellRendererProps) => ReactNode;
  cellEditor?: (props: CellEditorProps) => ReactNode;
  children?: GridColumnDef[];
}

interface CellRendererProps {
  value: CellValue;
  row: Row;
  rowIndex: number;
  column: GridColumnDef;
}

interface CellEditorProps {
  value: CellValue;
  row: Row;
  rowIndex: number;
  column: GridColumnDef;
  commit: (value: CellValue) => void;
  cancel: () => void;
}
```

## Source

[`packages/react/src/index.ts`](https://github.com/retemper/gridsmith/blob/main/packages/react/src/index.ts)
