# verify

Runs the full Turbo-based verification pipeline locally, mirroring CI. Catches failures before push.

## Execution Flow

### 1. Determine scope

Parse `$ARGUMENTS`:

| Argument      | Steps executed                            |
| ------------- | ----------------------------------------- |
| `all` or omit | build → type-check → lint → test → format |
| `build`       | build only                                |
| `type-check`  | build → type-check                        |
| `lint`        | lint only                                 |
| `test`        | build → test                              |
| `format`      | format:check only                         |

### 2. Run verification steps

Execute in dependency order. For `all`, collect all failures and report at the end.

```bash
# Step 1: Build
pnpm turbo build

# Step 2: Type check
pnpm turbo type-check

# Step 3: Lint
pnpm turbo lint

# Step 4: Test
pnpm turbo test

# Step 5: Format check
pnpm format:check
```

### 3. Report results

```markdown
## Verification Results

| Step       | Status  | Duration |
| ---------- | ------- | -------- |
| build      | ✅ Pass | 12s      |
| type-check | ✅ Pass | 8s       |
| lint       | ❌ Fail | 3s       |
| test       | ✅ Pass | 15s      |
| format     | ✅ Pass | 1s       |

Total: 4/5 passed, 1 failed
```

### 4. Auto-fix on failure

- **lint failure**: Ask to attempt `pnpm turbo lint -- --fix`
- **format failure**: Ask to auto-fix with `pnpm format`
- **type-check / test / build failure**: Show error output and suggest fixes

## Notes

- `build` must complete before `type-check` and `test`
- `lint` and `format:check` have no build dependency
- Turbo caching skips unchanged packages
- Mirrors `.github/workflows/ci.yml`

## Arguments

$ARGUMENTS
