# Columns

Resize, reorder, pin, and hide.

## Resize

Drag the right edge of any header. Min/max bounds via column config:

```ts
{ id: 'name', header: 'Name', width: 160, minWidth: 80, maxWidth: 400 }
```

Opt out:

```ts
{ id: 'actions', header: '', resizable: false }
```

Resizing fires:

```ts
grid.events.on('column:resize', ({ columnId, width }) => {
  // persist width to localStorage, etc.
});
```

In React, the `Grid` component takes an `onColumnResize` callback.

## Reorder

Drag a header to reorder columns. Disabled columns (`reorderable: false` if added in your fork) and pinned columns reorder within their pin group.

```ts
grid.events.on('column:reorder', ({ columnId, fromIndex, toIndex }) => {
  // persist order
});
```

Reorder is undoable — it's recorded by the [history](./undo-redo) plugin.

::: warning Group headers
Cross-group reorder (moving a column out of its parent group into another group) is currently a no-op. See [Group Headers](./group-headers).
:::

## Pin

Pin a column to the left or right viewport edge:

```ts
{ id: 'id', header: '#', pin: 'left', width: 60 }
{ id: 'actions', header: '', pin: 'right', width: 80 }
```

Pinned columns stay visible during horizontal scroll.

## Row pinning

`<Grid />` accepts `pinnedTopRows` and `pinnedBottomRows` — arrays of view-row indices that stick to the top / bottom edge during vertical scroll:

```tsx
<Grid
  data={rows}
  columns={columns}
  pinnedTopRows={[0]} // pin the first row
  pinnedBottomRows={[rows.length - 1]} // pin the last row
/>
```

## Hide / show

```ts
{ id: 'internal_id', header: 'Internal', visible: false }
```

Toggle at runtime by updating your column array — the grid reacts to `columns` prop changes.

## Default width

Per-grid default for columns without an explicit `width`:

```tsx
<Grid data={rows} columns={columns} defaultColumnWidth={140} />
```

## Read-only and uneditable

```ts
{ id: 'id', header: '#', editable: false }
```

Read-only columns:

- Skip editor activation.
- Are skipped by paste, fill, and `deleteSelection`.
- Render `aria-readonly="true"`.

## Programmatic API

```ts
grid.resizeColumn('name', 200); // (columnId, width)
grid.reorderColumn(0, 2); // (fromIndex, toIndex) — positional
```

`reorderColumn` takes the source and destination **leaf indices**, not column ids.

## Related

- [Group Headers](./group-headers) — multi-level header groups.
- [Sort & Filter](./sort-filter) — header click semantics.
