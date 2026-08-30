# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**seekstone** is an Obsidian MCP server, published to npm as [`seekstone`](https://www.npmjs.com/package/seekstone). The MCP server (`packages/server`) is the product: filesystem-direct vault access with low context-tax, shipped as a built single-file bundle. Alongside it lives the **measurement harness** (`packages/harness`) — a profiler + benchmark + write-safety suite that produced the payload numbers the server is designed around. The harness shares `packages/core` primitives with the server and is dev-only (run from source, not published).

The product story behind the harness (kept in version control because it's how the project will be evaluated): **filesystem-direct beats REST-proxy, and the win is mostly payload size ("context tax"), not raw CPU**. The harness exists to produce reproducible numbers that demonstrate that.

## Commands

```bash
npm run -w @seekstone/harness test                    # tests for harness only
npx tsc -p packages/harness/tsconfig.json --noEmit    # typecheck

# the harness itself (run after `npm install`)
npm run harness -- profile --vault "$SEEKSTONE_VAULT"
npm run harness -- bench   --queries packages/harness/queries/default.json --stats reports/vault-stats.json
npm run harness -- scenarios --backend seekstone --vault "$PWD/packages/harness/fixtures/vault"   # tokens-per-task
npm run harness -- safety  --vault "$SEEKSTONE_VAULT"
npm run harness -- fetch-models                       # download + pin-verify the Model2Vec embedding models
npm run harness -- retrieval --shipped                # retrieval-quality eval (golden set; --shipped = through the real search tool)

# the committed synthetic benchmark vault (no personal vault needed)
npm run harness -- gen-vault --count 10000            # regenerate fixtures/vault (deterministic, seed 42)
npm run harness -- fetch-corpus                       # download PG EB1911 corpus → fixtures/corpus/raw (gitignored)
npm run harness -- bench --backend fs --vault "$PWD/packages/harness/fixtures/vault" --out "$PWD/packages/harness/fixtures/baseline-reports"
```

The **server** has a real build — `npm run build -w seekstone` bundles it (and `packages/core`) to `dist/index.js` via tsup for publishing. The **harness** has no build step; it runs via `tsx`. `tsc` is used for typecheck only. Tests are co-located as `*.test.ts` next to source.

The **server** reads its own env vars — see the README's Configuration table. Write behavior to know before editing tools: deletes are recoverable (`.trash/`), every write tool supports optional `prevHash` compare-and-swap (moves and deletes included since 0.14.0; every mutating result returns a `contentHash`), moves rewrite inbound links, every write is policy-gated + atomic, and every write tool journals pre-images via `journalWrite` (single-file) or `ctx.journal.begin()` (multi-file: compute all rewrites first, journal them under one `seq`, then write) BEFORE the first vault byte changes so `undo_write` can restore the whole operation; `.seekstone/` is excluded from the walker like `.trash/`; and dispatch audits every write-tool call when `SEEKSTONE_AUDIT_FILE` is set — a new write tool must return an `audit` detail object from its dispatch case (paths/counts only, never content) or its calls are not recorded (see `docs/ARCHITECTURE.md` §2).

## Architecture

For the full picture — package graph, the server's five layers, the end-to-end request flow, and the harness — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (Mermaid diagrams). Keep it in sync when you add a layer, tool, or adapter. Harness internals (Backend interface, profiler, benchmark runner, write-safety, retrieval eval, adding a backend) live in `packages/harness/CLAUDE.md`, loaded when working under that package.

## Conventions

- **Module imports use `.js` extensions** even when importing TS sources — that's what NodeNext + tsx + tsc emit all agree on. `*.ts` extensions in imports require `allowImportingTsExtensions` and are avoided.
- **`Distribution` is the single percentile shape** (`min`/`median`/`p90`/`p95`/`p99`/`max`/`mean`). Any new metric goes through `summarise()` so the report tables stay uniform.
- **Reports are deterministic for a fixed snapshot.** Frontmatter-heavy notes are sorted lexically then strided so the safety sample is the same across runs of the same vault. `Math.random()` is banned harness-wide (seeded `prng.ts` when randomness is needed).
- **Never mutate the live vault.** Anything touching writes routes through the safety harness or an adapter pointed at a scratch copy. The CLI's `safety` command enforces this explicitly.

