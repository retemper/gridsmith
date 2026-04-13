# Gridsmith

> The MIT-licensed Handsontable. Excel-grade editing, modern DX, built for millions of rows.

[![CI](https://github.com/retemper/gridsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/retemper/gridsmith/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Packages

| Package                              | Description                                           | npm |
| ------------------------------------ | ----------------------------------------------------- | --- |
| [`@gridsmith/core`](packages/core)   | Headless core — state, editing engine, virtualization | -   |
| [`@gridsmith/react`](packages/react) | React adapter                                         | -   |
| [`@gridsmith/ui`](packages/ui)       | Preset UI components                                  | -   |

## Quick Start

```bash
pnpm add @gridsmith/react
```

```tsx
import { Grid } from '@gridsmith/react';

<Grid
  data={rows}
  columns={[
    { id: 'name', header: 'Name', editor: 'text' },
    { id: 'price', header: 'Price', editor: 'number' },
  ]}
  editable
/>;
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm turbo test

# Start playground
pnpm playground:dev
```

## Architecture

```
Framework Adapters   (@gridsmith/react)
Presets / UI Kit     (@gridsmith/ui)
Editing Engine       (selection, clipboard, fill, undo, validate)
Headless Core        (state, columns, rows, sort, filter)
Renderer             (DOM v1, Canvas v2)
Virtualization       (rows + columns)
Data Source           (sync, async, streaming)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
