# Gridsmith

MIT-licensed data grid with Excel-grade editing. No Pro tier, ever.

## Project Management

- **GitHub Project Board**: https://github.com/orgs/retemper/projects/1 (project number: 1, owner: retemper)
- **Repo**: retemper/gridsmith

## Custom Commands

| Command      | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `/ready`     | Find tasks ready to work on (not blocked by parent issues)       |
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

## Changesets

이 프로젝트는 [changesets](https://github.com/changesets/changesets)로 버전 관리를 한다.

### 퍼블리시 대상 패키지

`@gridsmith/core`, `@gridsmith/react`, `@gridsmith/ui` — 이 3개만 npm에 퍼블리시된다. apps/, examples/, e2e/ 는 private이므로 changeset 대상이 아니다.

### 언제 changeset을 추가해야 하는가

- `packages/` 하위 코드를 변경하면 반드시 changeset을 추가한다.
- `pnpm changeset` 실행 후 영향받는 패키지와 bump 타입(patch/minor/major)을 선택한다.
- apps/, docs, CI, 설정 파일만 변경한 경우 changeset이 필요 없다. CI에서 changeset check가 실패하면 `pnpm changeset add --empty`로 빈 changeset을 추가한다.

### Bump 타입 기준

- **patch**: 버그 수정, 내부 리팩터링 (API 변경 없음)
- **minor**: 새 기능 추가, 새 export 추가 (하위 호환)
- **major**: breaking change (API 삭제, 시그니처 변경, 동작 변경)

### 워크플로우

1. `pnpm changeset` — changeset 파일 생성 (.changeset/\*.md)
2. PR 머지 → version workflow가 자동으로 version PR 생성
3. version PR 머지 → publish workflow가 npm publish + GitHub release 생성

### linked / fixed

현재 linked/fixed 설정 없음. 각 패키지가 독립적으로 버저닝된다.
