# Contributing to Seekstone

Thanks for your interest in improving Seekstone! This is a small, focused project — a filesystem-direct Obsidian MCP server — and contributions of all sizes are welcome: bug reports, docs, tests, and features.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

Requires [Node.js](https://nodejs.org) ≥ 22.

```bash
git clone https://github.com/shaqmughal/seekstone.git
cd seekstone
npm install
```

This is an npm-workspaces monorepo:

| Package | What it is |
|---|---|
| `packages/server` | The published `seekstone` MCP server (the product). |
| `packages/core` | Shared vault primitives (walk, frontmatter, extract). Bundled into the server build. |
| `packages/harness` | Profiler + benchmark + write-safety harness. Dev-only; not published. |

## Development workflow

```bash
npm test                       # run all tests (vitest, all workspaces)
npm run lint                   # biome check (lint + format verification)
npm run format                 # biome auto-format
npm run build -w seekstone     # build the publishable server (tsup → dist/)

# typecheck a package
npx tsc -p packages/server/tsconfig.json --noEmit

# run a single test file / single test by name
npx vitest run packages/server/src/tools/search.test.ts
npx vitest run -t 'parses a typical frontmatter'
```

Before opening a PR, make sure **`npm test`, `npm run lint`, and the typechecks all pass** — CI runs them on macOS, Linux, and Windows and will block a merge otherwise.

## Conventions

- **Tests ship with the change.** Add or update co-located `*.test.ts` files for any code you touch. We aim to keep the server's logic modules well covered (CI enforces a coverage threshold).
- **Formatting is biome.** Run `npm run format` before committing and **stage all the files it changes**, not just the ones you edited.
- **Line endings are LF** (enforced via `.gitattributes`).
- **Imports use `.js` extensions** even for TypeScript sources — that's what NodeNext + tsx + tsc agree on.
- **Never mutate the live vault outside an explicit tool.** Write paths must preserve byte-faithful frontmatter; see the write-safety harness.
- **No telemetry, no network calls** in the server. This is a core promise — keep it.

## Commit & PR

- Branch off `main`; keep PRs focused.
- Write clear commit messages (imperative mood, e.g. "add tag index tool"). Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `ci:`) are encouraged but not required.
- **Add a changeset** for any user-facing change so it lands in the next release and CHANGELOG:
  ```bash
  npx changeset
  ```
  Pick `seekstone`, choose the bump (patch/minor/major), and write a one-line summary. Commit the generated `.changeset/*.md` file. Docs-only or internal changes don't need one. See [docs/RELEASING.md](docs/RELEASING.md) for how releases work.
- Open the PR against `main`; fill in the PR template; make sure CI is green.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/shaqmughal/seekstone/issues/new/choose). For security issues, **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
