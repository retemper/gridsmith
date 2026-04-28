# Events

Every event the grid emits, with the payload shape. Subscribe via `grid.events.on(name, handler)` or the convenience `grid.subscribe(name, handler)` (which returns the unsubscribe function).

## Data

| Event               | Payload                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `data:change`       | `{ changes: CellChange[] }` (`CellChange = { row: number, col: string, oldValue, newValue }`) |
| `data:rowsUpdate`   | `{ data: Row[] }`                                                                             |
| `columns:update`    | `{ columns: ColumnDef[] }`                                                                    |
| `columnDefs:update` | `{ columnDefs: ColumnDef[] }`                                                                 |

## View state

| Event             | Payload                                                    |
| ----------------- | ---------------------------------------------------------- |
| `sort:change`     | `{ sort: SortState }`                                      |
| `filter:change`   | `{ filter: FilterState }`                                  |
| `viewport:change` | `{ viewport: ViewportState }`                              |
| `column:resize`   | `{ columnId: string; width: number }`                      |
| `column:reorder`  | `{ columnId: string; fromIndex: number; toIndex: number }` |

## Editing

| Event         | Payload                                      |
| ------------- | -------------------------------------------- |
| `edit:begin`  | `EditState`                                  |
| `edit:commit` | `{ rowIndex, columnId, oldValue, newValue }` |
| `edit:cancel` | `{ rowIndex, columnId }`                     |

## Selection

| Event              | Payload          |
| ------------------ | ---------------- |
| `selection:change` | `SelectionState` |

## Clipboard

| Event             | Payload                                             |
| ----------------- | --------------------------------------------------- |
| `clipboard:copy`  | `{ range: CellRange; rows: number; cols: number }`  |
| `clipboard:cut`   | `{ range: CellRange; rows: number; cols: number }`  |
| `clipboard:paste` | `{ target: CellCoord; rows: number; cols: number }` |

## Transactions / history

| Event               | Payload                                    |
| ------------------- | ------------------------------------------ |
| `transaction:begin` | `{ depth: number }`                        |
| `transaction:end`   | `{ depth: number }`                        |
| `history:change`    | `{ canUndo, canRedo, undoSize, redoSize }` |

## Validation

| Event               | Payload                                  |
| ------------------- | ---------------------------------------- |
| `validation:change` | `{ errors: readonly ValidationError[] }` |

## Change tracking

| Event            | Payload                              |
| ---------------- | ------------------------------------ |
| `changes:update` | `{ dirty: readonly CellChange[] }`   |
| `changes:commit` | `{ changes: readonly CellChange[] }` |
| `changes:revert` | `{ changes: readonly CellChange[] }` |

## Async data

| Event               | Payload                                              |
| ------------------- | ---------------------------------------------------- |
| `asyncData:ready`   | `{ totalCount: number }`                             |
| `asyncData:loading` | `{ start: number; end: number }`                     |
| `asyncData:loaded`  | `{ start: number; end: number; totalCount: number }` |
| `asyncData:error`   | `{ error: Error; start?: number; end?: number }`     |

## Lifecycle

| Event          | Payload            |
| -------------- | ------------------ |
| `plugin:ready` | `{ name: string }` |
| `ready`        | `undefined`        |
| `destroy`      | `undefined`        |

## Subscription

```ts
const off = grid.events.on('data:change', ({ changes }) => {
  // …
});
off(); // unsubscribe

grid.events.once('ready', () => {
  // fires once
});

// Convenience wrapper
const unsubscribe = grid.subscribe('selection:change', (state) => {
  // …
});
```

The full event union type is `GridEvents`, exported from `@gridsmith/core`.
