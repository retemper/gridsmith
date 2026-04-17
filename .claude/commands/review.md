# review

Reviews changed code from expert perspectives. Selects the appropriate profile based on arguments or changed files.

## Usage

```
/review              → auto-detect profiles from git diff
/review code         → code quality review only
/review docs         → documentation review only
/review release      → release readiness review only
/review all          → all profiles
/review code <path>  → review a specific file
```

## Execution Flow

### 1. Determine profiles

- **Argument is `code`, `docs`, `release`, or `all`**: run that profile
- **No argument**: auto-detect from changed files
- **Argument is a file path**: infer profile from location

### 2. Collect target files

```bash
git diff --name-only HEAD
git diff --name-only --cached
# If no changes, use last commit
git diff --name-only HEAD~1
```

Map to profiles:

| File pattern                        | Profile |
| ----------------------------------- | ------- |
| `packages/*/src/**/*.ts`            | code    |
| `packages/*/src/**/*.tsx`           | code    |
| `apps/docs/**`                      | docs    |
| `.changeset/*.md`                   | release |
| `**/package.json` (version changes) | release |

### 3. Cross-validation: docs sync check

When `packages/*/src/**` files are changed, check whether related docs need updating:

1. Identify public API changes: new exports, changed function signatures, renamed types, removed APIs
2. Search `apps/docs/**` for references to the changed APIs
3. Flag if:
   - A new public export has no corresponding docs page or mention
   - A changed signature/behavior is documented with the old version
   - A removed API is still referenced in docs
   - Code examples in docs use outdated import paths or API calls

This check runs automatically whenever the `code` profile is active. Report violations under a **Docs Sync** section before the summary table.

### 4. Profile-specific reviews

#### Profile: code

**Perspective:** Senior TypeScript library author + React specialist

**Checklist:**

- **Type safety**: generics, no unnecessary `any`, well-defined exported types
- **Public API design**: breaking changes documented, exports minimal, naming consistent
- **Module boundaries**: no circular deps, proper workspace deps
- **Error handling**: descriptive errors, no swallowed failures
- **Test coverage**: new logic has tests, edge cases covered
- **Performance**: no unnecessary operations, efficient algorithms
- **React patterns**: proper hook usage, memo where needed, no stale closures
- **Accessibility**: ARIA attributes, keyboard navigation
- **Compatibility**: ESM-only, Node 22+, no platform-specific code

#### Profile: docs

**Perspective:** Developer experience writer

**Checklist:**

- **API docs accuracy**: examples match API, types correct
- **Code examples**: runnable, correct import paths
- **Navigation**: new pages linked, no broken links

#### Profile: release

**Perspective:** Release manager

**Checklist:**

- **Changeset presence**: all changed packages have changeset entry
- **Version consistency**: peer deps compatible, workspace deps aligned
- **Public API surface**: no accidental internal exports
- **Migration path**: breaking changes have instructions

### 5. Output format

Report only **violations** (skip passing items):

````markdown
## {Profile} Review

### {file path}

| #   | Category | Location | Issue  | Severity                    |
| --- | -------- | -------- | ------ | --------------------------- |
| 1   | {cat}    | L{num}   | {desc} | Critical/Warning/Suggestion |

#### Suggested fix #1

```diff
- current code
+ suggested code
```
````

> **Rationale**: {explanation}

````

### 6. Summary table

```markdown
| Profile | Critical | Warning | Suggestion |
|---------|----------|---------|------------|
| Code    | N        | N       | N          |
````

**Severity:** Critical = must fix | Warning = should fix | Suggestion = nice to have

## Notes

- Do NOT modify code — review and suggest only
- Only report violations
- Base on project conventions, not personal preference

## Arguments

$ARGUMENTS
