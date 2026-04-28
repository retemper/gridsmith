# Examples

Five runnable examples live in [`examples/`](https://github.com/retemper/gridsmith/tree/main/examples) of the repo. Clone the monorepo and run any of them with `pnpm`:

```bash
git clone https://github.com/retemper/gridsmith.git
cd gridsmith
pnpm install
pnpm --filter @gridsmith/example-react-basic dev
```

| Example                          | Highlights                                                         |
| -------------------------------- | ------------------------------------------------------------------ |
| [Basic](./basic)                 | 5 rows, mixed editors, `onCellChange`. The smallest possible grid. |
| [Editing](./editing)             | Sync validators, `validationMode: 'reject' \| 'warn'`              |
| [Large Dataset](./large-dataset) | 100,000 client-side rows. Virtualization stress test.              |
| [Async Data](./async)            | 50,000-row simulated server with infinite scroll.                  |
| [Custom Editor](./custom-editor) | A 7-color palette editor wired via `cellEditor`.                   |

All examples are real Vite apps under `examples/<name>/`, ready to copy into your own project.
