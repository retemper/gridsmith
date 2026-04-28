---
---

Build the documentation site (closes #19). No published-package changes —
docs and examples only.

- Adds a VitePress site under `apps/docs` with Getting Started, Installation,
  Core Concepts, 13 feature guides (editing, selection, clipboard, fill
  handle, undo/redo, validation, async data, change tracking, custom
  editors, sort/filter, columns, group headers, keyboard navigation,
  accessibility), and migration guides for Handsontable and AG Grid.
- Hand-curated API reference covering `@gridsmith/core`, `@gridsmith/react`,
  every emitted event, and the public type surface. (TypeDoc-driven
  auto-generation will replace these in a follow-up.)
- Adds 4 new runnable example apps under `examples/` — `editing`,
  `large-dataset`, `async-data`, `custom-editor` — and rebuilds the
  existing `react-basic` example into a real grid. Each example doc page
  embeds the source via VitePress `<<<` includes.
- The `Deploy Docs` workflow at `.github/workflows/docs.yml` already wires
  the build to GitHub Pages.
