# sync-main

Synchronizes the current branch with the latest state of `main`. Analyzes incoming changes before rebasing to detect conflicts proactively.

## Execution Flow

### 1. Check current branch

Do not run on `main`. Must be on a feature branch.

### 2. Fetch latest main

```bash
git fetch origin main
```

### 3. Analyze incoming changes

#### 3-1. Check new commits

```bash
git log --oneline HEAD..origin/main
```

If no new commits: "Already up to date." → skip to Step 4.

#### 3-2. Detect overlapping files

```bash
# Files changed on main
git diff --name-only HEAD...origin/main

# Files changed on current branch
git diff --name-only origin/main...HEAD
```

Compare lists. For overlapping files, read diffs and classify:

| Classification | Meaning                                    |
| -------------- | ------------------------------------------ |
| ✅ Safe        | Different regions modified                 |
| ⚠️ Caution     | Nearby regions (context conflict possible) |
| 🔴 Conflict    | Same lines modified                        |

#### 3-3. Report analysis

```markdown
## Main Sync Analysis

### Incoming (N commits)

- commit summaries

### Contention

| File       | Status      | Notes             |
| ---------- | ----------- | ----------------- |
| src/foo.ts | ✅ Safe     | Different regions |
| src/bar.ts | 🔴 Conflict | Same block        |
```

#### 3-4. User confirmation

- All ✅: proceed automatically
- ⚠️/🔴 present: ask user (Proceed / Inspect / Abort)

### 4. Check local changes

`git status` — if uncommitted changes exist, handle them.

### 5. Rebase

```bash
git rebase origin/main
```

Use analysis to guide conflict resolution.

### 6. Push

```bash
git push origin <branch> --force-with-lease
```

`--force-with-lease` is required after rebase. Never use `--force`.

## Notes

- Never run on `main`
- Always analyze before rebasing
- `--force-with-lease` after rebase is expected and safe

## Arguments

$ARGUMENTS
