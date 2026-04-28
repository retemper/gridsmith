# Clipboard

Copy and paste round-trip with Excel and Google Sheets. The clipboard plugin is auto-registered.

## Keyboard shortcuts

| Keys                   | Action                                         |
| ---------------------- | ---------------------------------------------- |
| `Ctrl/Cmd + C`         | Copy the active range                          |
| `Ctrl/Cmd + X`         | Cut — copy then clear cells                    |
| `Ctrl/Cmd + V`         | Paste at the active cell                       |
| `Delete` / `Backspace` | Clear every selected cell (or the focused one) |

When the focus is on a sibling text input (filter popover, your own input), the grid does **not** intercept — native clipboard behavior runs.

## Wire formats

The plugin writes both formats on copy:

- `text/plain` — TSV. Tabs separate columns, `\r\n` separates rows.
- `text/html` — minimal `<table>` with cell values escaped.

On paste it prefers the parsed HTML table and falls back to TSV.

| Value                | Serialized as          |
| -------------------- | ---------------------- |
| `true` / `false`     | `TRUE` / `FALSE`       |
| `Date`               | `YYYY-MM-DD`           |
| `null` / `undefined` | empty string           |
| number               | the locale-free string |

Paste coerces strings back to the target column's declared `type` (`number`, `checkbox`, `date`); unrecognized input stays as raw text.

## Excel quirks handled

- Trailing `\r\n` after the last row (Excel adds one).
- Multi-line cells wrapped in `"..."` quotes.
- HTML pasted from Excel that includes invisible style spans.

## Programmatic API

```ts
import type { ClipboardPluginApi } from '@gridsmith/react';

const clipboard = grid.getPlugin<ClipboardPluginApi>('clipboard');

// Each returns Promise<boolean> — false when there's nothing to copy or
// the Clipboard API is unavailable/denied.
await clipboard.copy();
await clipboard.cut();
await clipboard.paste();
clipboard.deleteSelection(); // returns boolean; clear without touching OS clipboard

// Lower-level helpers for custom toolbars
const tsv = clipboard.serializeRange(range);
const matrix = clipboard.parsePayload(text);
clipboard.applyMatrix(matrix, target);
```

In React headless mode (using `useGrid` directly), use the [`useGridClipboard`](/api/react#usegridclipboard) hook.

## Permissions and fallbacks

Modern Chromium / Firefox / Safari all support `ClipboardItem`. In hostile environments (older browsers, denied permissions, non-secure contexts) the plugin falls back to plain `navigator.clipboard.writeText`. HTML round-trip is best-effort.

## Events

| Event             | Payload                  |
| ----------------- | ------------------------ |
| `clipboard:copy`  | `{ range, rows, cols }`  |
| `clipboard:cut`   | `{ range, rows, cols }`  |
| `clipboard:paste` | `{ target, rows, cols }` |

## Read-only columns

Paste and `deleteSelection` skip cells where `editable === false`. The shape of the paste matrix is still anchored at the target — read-only columns leave their existing values intact.

## Related

- [Selection](./selection) — clipboard reads the active range.
- [Undo / Redo](./undo-redo) — paste is one undo step.
- [Validation](./validation) — pasted values run through validators.
