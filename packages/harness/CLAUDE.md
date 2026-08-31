# Harness (packages/harness)

Harness-specific guidance; the repo-wide picture is in the root `CLAUDE.md` and `docs/ARCHITECTURE.md`.

## Benchmark vault (committed fixture)

`packages/harness/fixtures/vault/` is a **committed 10,000-note synthetic vault** generated from the public-domain 1911 Encyclopædia Britannica (Project Gutenberg). It's the canonical, reproducible, personal-data-free benchmark target — use it instead of a personal vault. The generator (`src/fixtures/`, deterministic, seed 42) + pinned corpus manifest are committed; the raw corpus text under `fixtures/corpus/raw/` is gitignored and re-fetched on demand. The same committed-manifest/gitignored-payload pattern covers the Model2Vec embedding models (`fixtures/models/manifest.json` + `fetch-models`). `queries/golden.json` (150 retrieval queries: 90 semantic / 30 lexical / 30 topical, each carrying an immutable `split: dev|holdout` — tuning reads dev only, gate v2 reports on holdout only; SHA-312) is a committed methodology artifact guarded by `src/retrieval/golden.test.ts` — regenerating the vault with a different count/seed breaks it by design; fix the golden set in the same change. `src/fixtures/profile-fixture.test.ts` snapshots the vault's content-derived profile so the target can't silently drift. See `packages/harness/README.md`. Freshness stats are N/A for the fixture (mtime = checkout time).

## Required env vars (harness)

- `SEEKSTONE_VAULT` — absolute path to the Obsidian vault.
- `SEEKSTONE_REST_API_KEY` — required when invoking the `rest` backend; from the Local REST API plugin settings tab.
- `SEEKSTONE_REST_URL` — defaults to `https://127.0.0.1:27124`. The plugin ships a self-signed cert; the adapter accepts it via an isolated `undici.Agent`, never by setting `NODE_TLS_REJECT_UNAUTHORIZED`.

## Architecture

The harness is four modules behind one CLI. Profiler, benchmark runner, and write-safety share the `Backend` abstraction the shipped filesystem-direct server plugs into (the in-process `seekstone` adapter); the retrieval eval deliberately bypasses `Backend` and calls server internals directly — it measures ranking quality, not payload bytes.

### Backend interface (`packages/harness/src/bench/backend.ts`)
A small required core — `search`, `read`, `write`, `list` — plus optional extended tool methods (`listTags`, `contextPack`, `outline`, `getBacklinks`, `getLinks`, `getPeriodicNote`) and optional write-safety methods (`deleteNote`, `createNote`, `readWithHash`, `casWrite`, `casMove`, `casDelete`, `undoLastWrite` — declaring one claims the guard) that drive the behavioral safety ops, plus optional `searchStream` (TTFR) and `close`. Every adapter returns `{ result, payloadBytes }` so payload size — the headline metric — is captured at the boundary. The shipped server exposes this surface (21 tools; the `seekstone` adapter calls its tool functions in-process).

### Profiler (`packages/harness/src/profiler/`)
Walks the vault with `fast-glob`, classifies each file (`note` / `image` / `pdf` / `excalidraw` / `canvas` / …), reads each note, and aggregates. Two things are subtle and worth knowing before editing:

- **Frontmatter parsing is byte-aware.** `parseFrontmatter` reports `bodyStart` as a byte offset so write-safety ops can prove the FM region is byte-identical pre/post-write. Do **not** route reads through `yaml.stringify` to "normalize" anything — that destroys the round-trip contract.
- **`.excalidraw.md` is a note; `.excalidraw` is not.** The Excalidraw plugin saves both. `.excalidraw.md` has YAML frontmatter and links, so it's profiled like any other note. Pure `.excalidraw` is treated as a canvas-like attachment.

Link resolution is intentionally loose ("does any indexed note's basename or relative-path-without-extension match the wikilink target?") — this matches Obsidian's behaviour closely enough for shape-profiling without rebuilding its full resolver.

### Benchmark runner (`packages/harness/src/bench/`)
`runN()` returns **cold** (run 1), **warm** (runs 2..N), and **all** distributions for every measurement. The split exists so a cheap warm number can't hide a brutal cold start — both numbers go in the markdown report. Payload bytes mean is averaged across all runs.

The query sets under `packages/harness/queries/` (`default.json`, `tasks.json`, `golden.json`, per-size variants) are the methodology artifacts; `default.json` it must be edited per-vault (so the rare-term query actually matches your content) and committed. Re-runs against the same set is what makes results comparable across snapshots and adapters.

### Write-safety (`packages/harness/src/safety/`)
Three guard rails, in this order, and they all matter:

1. **`copyVault`** refuses if destination equals or is inside the source path. Scratch dirs land under `os.tmpdir()`.
2. **`runSafety`** re-asserts copy ≠ original before doing anything.
3. The **REST adapter writes to whatever vault Obsidian is open on** — so the workflow is two-phase: first invocation copies the vault and prints the path; you point Obsidian at the copy; second invocation runs with `--copy-vault-root`.

Nine ops per sampled backend — five byte-faithful: `identity` (byte equality), `body-append` (FM untouched, body == original + marker), `fm-edit` (body untouched, key order preserved, and every untouched FM line byte-identical), `patch-note`, `replace-in-note`; and four behavioral (`safety/behavioral-ops.ts`): `recoverable-delete` (lands in `.trash/`, byte-identical), `create-no-clobber`, `cas-conflict` (stale `prevHash` must be refused on write, move, and delete), `undo-roundtrip` (write through the server, `undoLastWrite`, note byte-identical to the original). `fm-edit` builds its expected bytes by pure text insertion — no YAML serializer touches the block, so the op can't inherit a serializer's own normalizations — and its verify asserts untouched source lines survive byte-identically: anything that round-trips the block through a stringifier (re-quoting, 80-column folding) fails the test, by design.


### Retrieval eval (`packages/harness/src/retrieval/`)
Quality, not payload: scores lexical vs semantic vs hybrid retrieval against `queries/golden.json` (hit@5 + MRR@10 per subset) and computes the pre-registered SHA-257 ship gate (hybrid ≥ +10 pts hit@5 on the semantic subset, ≤ 2 pts lexical regression, warm semantic p95 ≤ 15 ms @10k) in code. Golden-set rule: the fixture's tags and See-also links are RANDOM — relevance labels come from body prose only, and semantic queries must not contain their target's headword (test-enforced). `--experiments` adds the fusion candidates plus the SHA-313 pooling, SHA-314 MaxSim-rerank, and SHA-315 graph-expansion (xp-*) grids (never affect the gate); the server ships the SHA-314 winner — a MaxSim rerank of the semantic top-50 (`packages/server/src/semantic/rerank.ts`, verdict in `fixtures/baseline-reports/MAXSIM-SHA-314.md`) — but NOT graph expansion: the random-by-design fixture links make it unmeasurable, so `packages/server/src/semantic/expand.ts` stays unwired (verdict in `fixtures/baseline-reports/EXPANSION-SHA-315.md`); `--shipped` runs queries through the server's real `search` tool with `mode: semantic|hybrid` — note it reads/writes the real per-vault embedding cache (`SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone`). The committed baseline is `fixtures/baseline-reports/retrieval-eval.{json,md}` (produced with `--model potion-retrieval-32M,potion-base-8M --shipped --split all` — SHA-310; the shipped-* conditions are the opt-in 32M model).

## Adding a backend

Implement `Backend` in `packages/harness/src/bench/adapters/`. Wire it up in `cli.ts:buildBackend()`. Add an env var pattern matching `SEEKSTONE_<NAME>_*` for config. Reports pick up the new adapter via its `name` field — output files get suffixed `benchmark-<name>.{json,md}` and `safety-<name>.{json,md}` — but add the name to `src/bench/scaling.ts`'s `order` array or the scaling table sorts it last.
