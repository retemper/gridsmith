# Custom Editor

A custom React editor for picking colors from a 7-swatch palette.

**Run locally**

```bash
pnpm --filter @gridsmith/example-custom-editor dev
```

**Source** — [`examples/custom-editor/src/main.tsx`](https://github.com/retemper/gridsmith/blob/main/examples/custom-editor/src/main.tsx)

<<< @/../../examples/custom-editor/src/main.tsx

## What it shows

- `cellEditor: ({ value, commit, cancel }) => JSX` — render any React component as the editor.
- `cellRenderer` for a polished display when not editing — colored swatch + hex code.
- Auto-focus on mount for keyboard accessibility.
- `Esc` to cancel, click a swatch to commit.

## Pattern: keep the editor self-contained

A custom editor:

- Should auto-focus on mount.
- Should call `commit(value)` for any user action that finalizes the value.
- Should call `cancel()` for `Esc`.
- Doesn't need to manage navigation (`Tab` / `Enter`) — Gridsmith handles those.

For more advanced editors (autocompletes, popovers, masked inputs), see [Custom Editors](/guides/custom-editors).
