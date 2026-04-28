# Basic

A 5-row grid with mixed editors and a controlled data array.

**Run locally**

```bash
pnpm --filter @gridsmith/example-react-basic dev
```

**Source** — [`examples/react-basic/src/main.tsx`](https://github.com/retemper/gridsmith/blob/main/examples/react-basic/src/main.tsx)

<<< @/../../examples/react-basic/src/main.tsx

## What it shows

- Mixed column types: `text`, `number`, `checkbox`, `select`.
- A pinned `#` column (`pin: 'left'`) that's read-only (`editable: false`).
- Reacting to edits with `onCellChange` — you own the `data` array.

## Try it

- Double-click a cell or hit `F2` to edit.
- Click + drag the dot at the bottom-right of the selection to fill.
- `Ctrl/Cmd + C` / `V` to copy / paste.
- `Ctrl/Cmd + Z` to undo.
