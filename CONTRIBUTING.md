# Contributing to Gridsmith

## Prerequisites

- Node.js >= 22 (see `.nvmrc`)
- pnpm >= 10

## Setup

```bash
git clone https://github.com/retemper/gridsmith.git
cd gridsmith
pnpm install
pnpm turbo build
```

## Development Workflow

```bash
# Build all packages
pnpm turbo build

# Run tests
pnpm turbo test

# Type check
pnpm turbo type-check

# Lint
pnpm turbo lint

# Format
pnpm format

# Start playground dev server
pnpm playground:dev
```

## Project Structure

```
packages/
  core        Headless core + editing engine (vanilla TS)
  react       React adapter
  ui          Preset UI components
apps/
  docs        Documentation site (VitePress)
  playground  Interactive demo (Vite + React)
  benchmark   Performance benchmarks
examples/
  react-basic Basic React usage example
e2e/          Playwright end-to-end tests
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add a changeset if you changed a published package: `pnpm changeset`
4. Push and open a PR
5. PR title must follow conventional commits: `feat:`, `fix:`, `chore:`, etc.
6. CI must pass before merge

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(core):` — new feature
- `fix(react):` — bug fix
- `docs:` — documentation changes
- `chore:` — maintenance tasks
- `refactor:` — code refactoring
- `test:` — test additions/changes
- `perf:` — performance improvements

Scopes: `core`, `react`, `ui`, `docs`, `playground`, `benchmark`, `e2e`

## Changesets

When changing a published package (`@gridsmith/core`, `@gridsmith/react`, `@gridsmith/ui`):

```bash
pnpm changeset
```

This creates a changeset file describing the change and version bump type.
