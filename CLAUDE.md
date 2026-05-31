# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**seekstone** is an Obsidian MCP server, published to npm as [`seekstone`](https://www.npmjs.com/package/seekstone). The MCP server (`packages/server`) is the product: filesystem-direct vault access with low context-tax, shipped as a built single-file bundle. Alongside it lives the **measurement harness** (`packages/harness`) — a profiler + benchmark + write-safety suite that produced the payload numbers the server is designed around. The harness shares `packages/core` primitives with the server and is dev-only (run from source, not published).

The product story behind the harness (kept in version control because it's how the project will be evaluated): **filesystem-direct beats REST-proxy, and the win is mostly payload size ("context tax"), not raw CPU**. The harness exists to produce reproducible numbers that demonstrate that.

## Commands

```bash
npm install                                           # install workspace deps
npm test                                              # vitest, all workspaces
npm run -w @seekstone/harness test                    # tests for harness only
npx vitest run packages/harness/src/foo.test.ts       # single test file
npx vitest run -t 'parses a typical frontmatter'      # single test by name
npx tsc -p packages/harness/tsconfig.json --noEmit    # typecheck
npm run lint                                          # biome check
npm run format                                        # biome write

# the harness itself (run after `npm install`)
npm run harness -- profile --vault "$SEEKSTONE_VAULT"
npm run harness -- bench   --queries packages/harness/queries/default.json --stats reports/vault-stats.json
npm run harness -- safety  --vault "$SEEKSTONE_VAULT"
```

The **server** has a real build — `npm run build -w seekstone` bundles it (and `packages/core`) to `dist/index.js` via tsup for publishing. The **harness** has no build step; it runs via `tsx`. `tsc` is used for typecheck only. Tests are co-located as `*.test.ts` next to source.

## Required env vars

- `SEEKSTONE_VAULT` — absolute path to the Obsidian vault.
- `SEEKSTONE_REST_API_KEY` — required when invoking the `rest` backend; from the Local REST API plugin settings tab.
- `SEEKSTONE_REST_URL` — defaults to `https://127.0.0.1:27124`. The plugin ships a self-signed cert; the adapter accepts it via an isolated `undici.Agent`, never by setting `NODE_TLS_REJECT_UNAUTHORIZED`.

## Architecture

The harness is three modules behind one CLI, all sharing the same `Backend` abstraction so the eventual filesystem-direct server slots in without rewriting consumers.

### Backend interface (`packages/harness/src/bench/backend.ts`)
One small contract: `search`, `read`, `write`, `list`. Every adapter returns `{ result, payloadBytes }` so payload size — the headline metric — is captured at the boundary. The MCP server is being designed to expose exactly this surface, which is why it's tiny on purpose.

### Profiler (`packages/harness/src/profiler/`)
Walks the vault with `fast-glob`, classifies each file (`note` / `image` / `pdf` / `excalidraw` / `canvas` / …), reads each note, and aggregates. Two things are subtle and worth knowing before editing:

- **Frontmatter parsing is byte-aware.** `parseFrontmatter` reports `bodyStart` as a byte offset so write-safety ops can prove the FM region is byte-identical pre/post-write. Do **not** route reads through `yaml.stringify` to "normalize" anything — that destroys the round-trip contract.
- **`.excalidraw.md` is a note; `.excalidraw` is not.** The Excalidraw plugin saves both. `.excalidraw.md` has YAML frontmatter and links, so it's profiled like any other note. Pure `.excalidraw` is treated as a canvas-like attachment.

Link resolution is intentionally loose ("does any indexed note's basename or relative-path-without-extension match the wikilink target?") — this matches Obsidian's behaviour closely enough for shape-profiling without rebuilding its full resolver.

### Benchmark runner (`packages/harness/src/bench/`)
`runN()` returns **cold** (run 1), **warm** (runs 2..N), and **all** distributions for every measurement. The split exists so a cheap warm number can't hide a brutal cold start — both numbers go in the markdown report. Payload bytes mean is averaged across all runs.

The query set (`packages/harness/queries/default.json`) is the methodology artifact: it must be edited per-vault (so the rare-term query actually matches your content) and committed. Re-runs against the same set is what makes results comparable across snapshots and adapters.

### Write-safety (`packages/harness/src/safety/`)
Three guard rails, in this order, and they all matter:

1. **`copyVault`** refuses if destination equals or is inside the source path. Scratch dirs land under `os.tmpdir()`.
2. **`runSafety`** re-asserts copy ≠ original before doing anything.
3. The **REST adapter writes to whatever vault Obsidian is open on** — so the workflow is two-phase: first invocation copies the vault and prints the path; you point Obsidian at the copy; second invocation runs with `--copy-vault-root`.

Three ops per sampled note: `identity` (byte equality), `body-append` (FM untouched, body == original + marker), `fm-edit` (body untouched, existing FM key order preserved). `fm-edit` uses `yaml.parseDocument` because that's the only way to preserve comments / quote style / key order — anything that route-trips through `parseYaml` + `stringify` will fail the test, by design.

## Conventions

- **Module imports use `.js` extensions** even when importing TS sources — that's what NodeNext + tsx + tsc emit all agree on. `*.ts` extensions in imports require `allowImportingTsExtensions` and are avoided.
- **`Distribution` is the single percentile shape** (`min`/`median`/`p90`/`p95`/`p99`/`max`/`mean`). Any new metric goes through `summarise()` so the report tables stay uniform.
- **Reports are deterministic for a fixed snapshot.** Frontmatter-heavy notes are sorted lexically then strided so the safety sample is the same across runs of the same vault. Don't introduce `Math.random()` anywhere in profiler or safety paths.
- **Never mutate the live vault.** Anything touching writes routes through the safety harness or an adapter pointed at a scratch copy. The CLI's `safety` command enforces this explicitly.

## Adding a backend

Implement `Backend` in `packages/harness/src/bench/adapters/`. Wire it up in `cli.ts:buildBackend()`. Add an env var pattern matching `SEEKSTONE_<NAME>_*` for config. Reports automatically pick up the new adapter via its `name` field — output files get suffixed `benchmark-<name>.{json,md}` and `safety-<name>.{json,md}`.
