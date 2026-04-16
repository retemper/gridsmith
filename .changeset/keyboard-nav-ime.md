---
'@gridsmith/react': minor
---

Add full keyboard navigation (arrow keys, Tab/Shift+Tab wrap, Home/End, Ctrl+Home/End, Ctrl+Arrow edge jump, PageUp/PageDown), Shift+Enter to move up in nav mode, and Enter/Shift+Enter commit-and-move during editing. Focused cell exposes a `gs-cell--focused` CSS hook and scrolls into view on navigation. IME composition is respected — Enter/Tab no longer prematurely commit during Korean/Japanese/Chinese composition.
