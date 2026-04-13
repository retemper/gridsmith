# Gridsmith

MIT-licensed data grid with Excel-grade editing. No Pro tier, ever.

## Project Management

- **GitHub Project Board**: https://github.com/orgs/retemper/projects/1 (project number: 1, owner: retemper)
- **Repo**: retemper/gridsmith

## Custom Commands

| Command      | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `/project`   | Project board status, create/update issues, milestone management |
| `/rfc`       | Review RFC design docs, resolve open questions                   |
| `/sprint`    | Sprint planning, standup, burndown                               |
| `/pr`        | Analyze changes, create commit, push, open PR                    |
| `/review`    | Code review from expert perspectives (code/docs/release)         |
| `/verify`    | Run full build/test/lint pipeline locally                        |
| `/sync-main` | Rebase on main with conflict analysis                            |
| `/help`      | List all available commands                                      |

## Milestones

- M0 — Design RFCs (#22-#27, due 2026-04-27)
- M1 — Foundation (#1-#9, due 2026-05-13)
- M2 — Excel-grade (#10-#16, due 2026-06-13)
- M3 — Polish & Launch (#17-#21, due 2026-07-13)

## Tech Stack

pnpm + turborepo + changesets + tsup + vitest + playwright

## Package Structure

```
packages/core       Headless core + editing engine (vanilla TS)
packages/react      React adapter
packages/ui         Preset UI components
apps/docs           Documentation (VitePress)
apps/playground     Interactive demo (Vite + React)
apps/benchmark      Performance benchmarks
examples/           Usage examples
e2e/                Playwright E2E tests
```

## Architecture

Layered: Data Source → Virtualization → Renderer (DOM) → Headless Core → Editing Engine → Framework Adapter (React)

Plugin-based editing engine: selection, clipboard, fill handle, undo/redo as independent plugins.

## Development

```bash
pnpm install          # install deps
pnpm turbo build      # build all packages
pnpm turbo test       # run tests
pnpm turbo type-check # type check
pnpm turbo lint       # lint
pnpm format:check     # format check
pnpm playground:dev   # start playground
```
