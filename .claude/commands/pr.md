# pr

Analyzes all commits and changes on the current branch, drafts an appropriate PR title and body, pushes, and creates a pull request.

## Execution Flow

### 1. Check current state

```bash
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ]; then exit 1; fi
git status
git diff --stat
```

- If on `main`, inform the user and stop.
- If there are uncommitted changes, ask whether to commit them first.

### 2. Analyze changes

```bash
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

Determine: nature of changes (feat, fix, chore, etc.), summary (1-3 lines), test plan items.

### 3. Check for changeset

If changes touch files under `packages/`, verify a changeset file exists:

```bash
ls .changeset/*.md 2>/dev/null | grep -v README
```

If no changeset found for a publishable package change, warn and ask whether to proceed.

### 4. Draft PR title and body

**Title priority:**

1. If `$ARGUMENTS` is provided, use it as-is.
2. Otherwise, auto-generate from commit messages and changes.

**Title rules:** Under 70 characters, use conventional prefix (`feat:`, `fix:`, `chore:`, etc.)

**Body format:**

```markdown
## Summary

- [1-3 bullet points]

## Test plan

- [ ] [Testing checklist items]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 5. Sync with main

```bash
git fetch origin main
git merge origin/main
```

### 6. Push and create PR

```bash
git push -u origin $BRANCH
gh pr create --title "$TITLE" --body "$BODY"
```

### 7. Report the created PR URL

## Notes

- Cannot run on `main` branch
- Always sync with main before push
- If a PR already exists for this branch, inform and stop

## Arguments

$ARGUMENTS
