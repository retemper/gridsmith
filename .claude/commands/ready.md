# Gridsmith Ready Tasks

Analyze the GitHub project board and sub-issue hierarchy to find tasks that are **ready to work on right now** — not blocked by incomplete parent issues.

## Context

- **Repo**: retemper/gridsmith
- **Project Board**: `gh project` with `--owner retemper`, project number `1`
- **Sub-issue hierarchy**: Parent issues must be completed (or have no blockers) before children can start. Use the GitHub sub-issues API to traverse the tree.

## Execution Flow

### 1. Fetch all open issues with metadata

```bash
gh issue list --repo retemper/gridsmith --state open --json number,title,labels,milestone --limit 50
```

### 2. Build the sub-issue tree

For every open issue, check if it is a sub-issue (has a parent) and if it has sub-issues (is a parent):

```bash
# Check if issue has a parent
gh api /repos/retemper/gridsmith/issues/<number> --jq '.parent // empty'

# Check if issue has sub-issues
gh api /repos/retemper/gridsmith/issues/<number>/sub_issues --jq '.[].number'
```

Build a dependency map:

- `parent[child] = parentNumber`
- `children[parent] = [childNumbers...]`

### 3. Determine which issues are "ready"

An issue is **ready** if ALL of the following are true:

1. It is **open**
2. It has **no open parent issue** — either it has no parent, or its parent is already closed
3. It is a **leaf node** OR its own scope is workable independent of children (parent issues that define foundational work are ready even if they have open children)
4. It is not an RFC issue (label `rfc`) — RFCs are design docs, not implementation tasks

An issue is **blocked** if:

- Its parent issue is still open (the parent's work must be done first)

### 4. Prioritize the ready list

Sort ready issues by:

1. Priority label: P0-critical > P1-high > P2-medium > P3-low
2. Milestone order: M0 > M1 > M2 > M3
3. Issue number (lower = earlier)

### 5. Present results

Show a summary table with milestone filter if `$ARGUMENTS` specifies one (e.g., `M1`, `M2`).

## Response Format

### Ready Tasks

| #   | Title | Priority | Milestone | Labels |
| --- | ----- | -------- | --------- | ------ |

### Blocked Tasks

| #   | Title | Blocked by | Reason |
| --- | ----- | ---------- | ------ |

### Summary

- Total open: X
- Ready now: Y
- Blocked: Z
- Progress: `[████░░░░░░] 40%` (closed / total per milestone)

## Notes

- If `$ARGUMENTS` contains a milestone name (e.g., `M1`), filter to that milestone only
- If `$ARGUMENTS` contains `--all`, show all milestones
- Default (no args): show the earliest active milestone (first one with open issues)
- Always include issue URLs for easy navigation
- Flag issues that have been open for a long time without progress

## Arguments

$ARGUMENTS
