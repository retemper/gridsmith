# Gridsmith

> The MIT-licensed Handsontable. Excel-grade editing, modern DX, built for millions of rows.

[![CI](https://github.com/retemper/gridsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/retemper/gridsmith/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![@gridsmith/core](https://img.shields.io/npm/v/@gridsmith/core.svg?label=%40gridsmith%2Fcore)](https://www.npmjs.com/package/@gridsmith/core)
[![@gridsmith/react](https://img.shields.io/npm/v/@gridsmith/react.svg?label=%40gridsmith%2Freact)](https://www.npmjs.com/package/@gridsmith/react)

---

## Packages

| Package                              | Description                                           | npm                                                                                                         |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`@gridsmith/core`](packages/core)   | Headless core — state, editing engine, virtualization | [![npm](https://img.shields.io/npm/v/@gridsmith/core.svg)](https://www.npmjs.com/package/@gridsmith/core)   |
| [`@gridsmith/react`](packages/react) | React adapter                                         | [![npm](https://img.shields.io/npm/v/@gridsmith/react.svg)](https://www.npmjs.com/package/@gridsmith/react) |
| [`@gridsmith/ui`](packages/ui)       | Preset UI components                                  | _planned for 1.x_                                                                                           |

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
/>;
```

## Features

| Capability                                                               | Status |
| ------------------------------------------------------------------------ | ------ |
| Cell editing (text / number / select / checkbox / date + custom editors) | ✅     |
| Range selection (single + multi-range, row, column)                      | ✅     |
| Excel-compatible clipboard (TSV + HTML copy / paste / cut)               | ✅     |
| Fill handle with pattern detection (numbers, dates, sequences)           | ✅     |
| Undo / redo (Command pattern with batch grouping)                        | ✅     |
| Sync + async cell validation                                             | ✅     |
| Sort / filter (controlled or uncontrolled)                               | ✅     |
| Column resize, reorder, and left/right pinning                           | ✅     |
| Top / bottom row pinning                                                 | ✅     |
| Multi-level group headers                                                | ✅     |
| Async data source + infinite scroll                                      | ✅     |
| Change tracking (dirty cells, batch commit / revert)                     | ✅     |
| Full keyboard nav with IME-safe composition                              | ✅     |
| WAI-ARIA 1.2 grid pattern + screen-reader announcements                  | ✅     |
| Row + column virtualization (1M-row scrolling)                           | ✅     |
| MIT licensed — no Pro tier, ever                                         | ✅     |

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
