# Keyboard Navigation

Gridsmith supports full keyboard navigation in both **navigation mode** and **edit mode**.

## Navigation mode

| Keys                  | Action                                          |
| --------------------- | ----------------------------------------------- |
| Arrow keys            | Move active cell                                |
| `Tab` / `Shift+Tab`   | Move right / left, wraps to next / previous row |
| `Enter`               | Move down (or begin editing — see below)        |
| `Shift+Enter`         | Move up                                         |
| `Home` / `End`        | First / last column in current row              |
| `Ctrl/Cmd + Home/End` | First / last cell in the grid                   |
| `Ctrl/Cmd + Arrow`    | Jump to the next non-empty edge                 |
| `PageUp` / `PageDown` | Move one viewport up / down                     |
| `F2`                  | Begin editing the active cell                   |
| Type a character      | Begin editing and replace the value             |

## Edit mode

| Keys          | Action                                    |
| ------------- | ----------------------------------------- |
| `Enter`       | Commit and move down                      |
| `Shift+Enter` | Commit and move up                        |
| `Tab`         | Commit and move right (wraps to next row) |
| `Shift+Tab`   | Commit and move left                      |
| `Esc`         | Cancel — revert to pre-edit value         |

## Selection extensions

| Keys            | Action                   |
| --------------- | ------------------------ |
| `Shift + Arrow` | Extend the active range  |
| `Ctrl/Cmd + A`  | Select all               |
| `Shift + Space` | Select the active row    |
| `Ctrl + Space`  | Select the active column |
| `Esc`           | Clear selection          |

## Clipboard

| Keys                   | Action                                      |
| ---------------------- | ------------------------------------------- |
| `Ctrl/Cmd + C`         | Copy active range                           |
| `Ctrl/Cmd + X`         | Cut active range                            |
| `Ctrl/Cmd + V`         | Paste at active cell                        |
| `Delete` / `Backspace` | Clear every selected cell (or focused cell) |

## Undo / Redo

| Keys                                    | Action |
| --------------------------------------- | ------ |
| `Ctrl/Cmd + Z`                          | Undo   |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo   |

## Focus model

The grid uses the **container-focus** model from the WAI-ARIA grid pattern:

- The grid root is the focused element.
- `aria-activedescendant` points at the currently-focused cell.
- Cell IDs are stable (you can compose them with `buildCellId(gridId, rowIndex, columnId)`).

This means screen readers announce focus changes without DOM focus moving cell-to-cell — fewer focus events, smoother navigation.

The focused cell scrolls into view automatically on every move and gets the `gs-cell--focused` CSS hook.

## IME safety

CJK composition (Korean / Japanese / Chinese) is respected:

- `Enter` and `Tab` during composition do **not** prematurely commit.
- The editor commits only after `compositionend` resolves.

If you build a [custom editor](./custom-editors), do the same — listen for `compositionstart`/`compositionend` and gate your own commit logic.

## Sibling inputs

When focus is on a sibling text input (your toolbar, the filter popover), the grid does not intercept clipboard / undo / navigation keys. Native input behavior runs.

## Related

- [Selection](./selection) — selection state and ranges.
- [Cell Editing](./editing) — editor lifecycle.
- [Accessibility](./accessibility) — ARIA and screen-reader announcements.
