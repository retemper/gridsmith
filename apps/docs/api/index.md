# API Reference

The public API is everything exported from each package's `index.ts` barrel. Anything else is internal — not part of the SemVer contract.

## Packages

| Package                       | What's in it                                  |
| ----------------------------- | --------------------------------------------- |
| [`@gridsmith/core`](./core)   | `createGrid`, plugin creators, signals, types |
| [`@gridsmith/react`](./react) | `<Grid />`, hooks, React-extended types       |

## Cross-cutting references

- [Events](./events) — every event the grid emits and its payload.
- [Types](./types) — `ColumnDef`, `Row`, `CellValue`, plugin states, etc.

## Source

The barrel files are the source of truth:

- [`packages/core/src/index.ts`](https://github.com/retemper/gridsmith/blob/main/packages/core/src/index.ts)
- [`packages/react/src/index.ts`](https://github.com/retemper/gridsmith/blob/main/packages/react/src/index.ts)

## Naming conventions

- `createXPlugin` — factory for plugin instances. Pass to `plugins` prop.
- `XPluginApi` — the API exposed by a plugin via `getPlugin<T>(name)`.
- `XPluginOptions` — options for the corresponding `createXPlugin`.
- Hooks (`useGridX`) — read plugin APIs from a grid instance created by `useGrid`.

## Stability

- All public exports are versioned via [Changesets](https://github.com/retemper/gridsmith/blob/main/.changeset).
- A breaking change to any public export ships as a major bump.
- Cell-id format produced by `buildCellId` / `buildPinnedCellId` is part of the public contract.

## Auto-generated reference

A future revision will swap these summary pages for output from TypeDoc + `typedoc-plugin-markdown`. Until then, these pages are kept in sync by hand.
