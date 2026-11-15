# CLAUDE.md

Guidance for AI coding agents (and people) working in this repo. `AGENTS.md` points here, so every tool gets the same rules.

## What this repo is

**seekstone** is an Obsidian MCP server, published to npm as [`seekstone`](https://www.npmjs.com/package/seekstone). The server (`packages/server`) is the product: filesystem-direct vault access with a low context tax, shipped as a single-file bundle. The **measurement harness** (`packages/harness`) is a profiler, benchmark and write-safety suite that produced the numbers the server is designed around. Both share `packages/core`. The harness is dev-only and not published.

The claim the project is judged on: **filesystem-direct beats REST-proxy, and the win is mostly payload size ("context tax"), not raw CPU.** Speed matters as much. Don't trade a benchmark regression for a feature.

## Where the rules live

| Working on | Read |
|---|---|
| Server tools, writes, dispatch, the admission bar for new tools | [`packages/server/CLAUDE.md`](packages/server/CLAUDE.md) |
| Shared primitives (walk, frontmatter, extract, embed) | [`packages/core/CLAUDE.md`](packages/core/CLAUDE.md) |
| Harness commands, the benchmark vault, env vars | [`packages/harness/CLAUDE.md`](packages/harness/CLAUDE.md) |
| Package graph, server layers, request flow | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Keep it in sync when you add a layer, tool or adapter. |
| Setup, CI gates, PR checks, changesets | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Write safety guarantees | [`docs/WRITE-SAFETY.md`](docs/WRITE-SAFETY.md) |
| Required checks, quality rules, speed gates, the factory | [`docs/QUALITY-GATES.md`](docs/QUALITY-GATES.md) |
| Shared Claude Code permissions and the Biome edit hook | [`.claude/settings.json`](.claude/settings.json) |

## Commands

```bash
npm test                                         # all workspaces (vitest)
npm run lint                                     # biome check
npm run format                                   # biome write; stage every file it changes
npm run build -w seekstone                       # bundle the server to dist/ (tsup)
npx tsc -p packages/server/tsconfig.json --noEmit
npx vitest run packages/server/src/tools/search.test.ts
npm run bench -w seekstone                       # hot-path benchmarks
```

Only the server has a build. The harness runs from source through `tsx`; `tsc` is typecheck only.

## Conventions

- **Relative imports use `.js` extensions**, even for TypeScript sources. NodeNext, tsx and tsc all agree on that; `.ts` extensions are avoided.
- **Tests ship with the change**, co-located as `*.test.ts`. Don't delete, skip or loosen tests to get green; CI flags it.
- **Never mutate a real vault.** Writes go through the safety harness or an adapter pointed at a scratch copy. Tests use temp copies or the committed fixtures.
- **No telemetry and no network calls on the serving path.** `no-network.test.ts` guards it.
- **Changesets** name only `seekstone`; the other packages are private.

## Writing

Docs, PR descriptions, commit messages, changesets and code comments are read by people. Write them plainly:

- Say what changed and why, in short sentences. Lead with the point.
- Use ordinary words. Skip "leverage", "robust", "seamless", "comprehensive", "delve", "crucial" and the like.
- No sales tone or inflated claims. Give the number instead of an adjective.
- Don't stage a reveal ("Here's the thing:"), don't build "not X, but Y" contrasts, and don't end on a one-line summary that repeats the paragraph.
- Avoid lists of three by reflex, piles of bold labels, and dashes used as punctuation everywhere.
- Commit messages are imperative ("add tag index tool"); conventional prefixes are welcome.
