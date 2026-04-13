# help

Lists all available custom slash commands with descriptions.

## Execution Flow

1. Use the Glob tool to find all `.claude/commands/*.md` files.
2. Read each file's first `# heading` as the command name and the first paragraph as the description.
3. Output as a sorted table:

```markdown
## Available Slash Commands

| Command  | Description      |
| -------- | ---------------- |
| /command | Description text |
```

**Important:** Do NOT hardcode the list. Always scan the filesystem to reflect the latest state.

## Arguments

$ARGUMENTS
