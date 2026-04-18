---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add Excel-compatible clipboard: TSV + HTML copy, paste, cut, delete.

**Core (`@gridsmith/core`):**

- New `createClipboardPlugin` exports a `'clipboard'` plugin that depends
  on `'selection'` and round-trips cell values with Excel and Google
  Sheets.
- New types: `ClipboardPayload`, `ClipboardMatrix`, `ClipboardPluginApi`.
  The API exposes `copy`, `cut`, `paste`, `deleteSelection`,
  `serializeRange`, `parsePayload`, and `applyMatrix` for programmatic
  use.
- Copy writes both `text/plain` (TSV) and `text/html` (minimal `<table>`)
  via the modern `ClipboardItem` API, with a `writeText` fallback when
  rich writes are unavailable or denied.
- Paste prefers parsed HTML tables and falls back to TSV; multi-line
  quoted cells and Excel's trailing CRLF are handled transparently.
- Values are formatted for Excel compatibility: booleans as `TRUE`/`FALSE`,
  dates as `YYYY-MM-DD`, `null`/`undefined` as empty string. Paste coerces
  strings back to the target column's declared type (`number`, `checkbox`,
  `date`) and leaves unrecognized input as raw text.
- `deleteSelection` clears every editable cell across all ranges, skips
  `editable: false` columns, and batches changes in a single update.
- New grid events: `clipboard:copy`, `clipboard:cut`, `clipboard:paste`.

**React (`@gridsmith/react`):**

- Auto-registers the clipboard plugin alongside editing and selection.
- Keyboard parity with Excel: Ctrl/Cmd+C copies the active range,
  Ctrl/Cmd+X cuts, Ctrl/Cmd+V pastes at the active cell, and
  Delete/Backspace clears every selected cell (falling back to the
  focused cell when there is no range selection).
- Sibling text inputs (e.g. filter popovers) keep native clipboard
  behavior — the grid only intercepts when focus is on the grid itself.
- New `useGridClipboard(grid)` hook exposes the clipboard API for
  programmatic copy/cut/paste in custom toolbars.
