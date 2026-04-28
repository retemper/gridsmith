# Editing & Validation

Built-in editors with sync validators in both `reject` and `warn` modes.

**Run locally**

```bash
pnpm --filter @gridsmith/example-editing dev
```

**Source** — [`examples/editing/src/main.tsx`](https://github.com/retemper/gridsmith/blob/main/examples/editing/src/main.tsx)

<<< @/../../examples/editing/src/main.tsx

## What it shows

- `validate: (value) => true | string` — sync validators that return a message on failure.
- `validationMode: 'reject'` (the default) — bad commits are blocked.
- `validationMode: 'warn'` — bad commits succeed but the cell stays decorated.
- Pre-existing invalid data — the third row starts with a bad email and an out-of-range age.

## Try it

- Edit the email cell of row 3 to a valid email — the red indicator clears.
- Try setting an age to `999` — it commits (warn mode) but stays flagged.
- Try clearing the name cell — the commit is rejected and the previous value is restored.

For async validators, see [Validation guide → Async validators](/guides/validation#async-validators).
