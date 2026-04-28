# Installation

## Requirements

- Node.js **22 or newer** (for tooling)
- React **18.0+** (peer dependency; 18.x and 19.x both supported)
- TypeScript **5.0+** (recommended; not required at runtime)

## Packages

| Package            | When to install                                        |
| ------------------ | ------------------------------------------------------ |
| `@gridsmith/react` | You're building a React app. Re-exports core symbols.  |
| `@gridsmith/core`  | Framework-agnostic. Use directly for non-React stacks. |
| `@gridsmith/ui`    | Optional preset UI components.                         |

### React

::: code-group

```bash [pnpm]
pnpm add @gridsmith/react react react-dom
```

```bash [npm]
npm install @gridsmith/react react react-dom
```

```bash [yarn]
yarn add @gridsmith/react react react-dom
```

```bash [bun]
bun add @gridsmith/react react react-dom
```

:::

`@gridsmith/react` re-exports `@gridsmith/core`'s public API so a single install is enough.

### Headless (no framework)

```bash
pnpm add @gridsmith/core
```

Use [`createGrid`](/api/core#creategrid) with [`createRenderer`](/api/core#createrenderer) to mount a grid into a DOM element directly.

## Browser support

Modern evergreen browsers. Specifically:

- Chromium 109+
- Firefox 115+
- Safari 16+

Gridsmith uses `ResizeObserver`, modern `Clipboard` (`ClipboardItem`), and CSS Grid. No IE11.

## TypeScript

Types ship with the published packages — no `@types` package needed. Strict mode is recommended:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
  },
}
```

## Bundle size

`@gridsmith/core` is tree-shakeable. Plugins you don't import aren't bundled. The React adapter auto-registers every editing-engine plugin (selection, clipboard, fill-handle, history, validation), but if you build with `@gridsmith/core` directly you only pay for what you register.

## Versioning

Each `@gridsmith/*` package versions independently via [Changesets](https://github.com/changesets/changesets). The current alpha-phase versions are noted in the [Changelog](https://github.com/retemper/gridsmith/releases).

## Next

- [Getting Started](./getting-started) — your first grid in 30 seconds
- [Core Concepts](./concepts) — how the pieces fit together
