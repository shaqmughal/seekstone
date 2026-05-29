# seekstone

An Obsidian MCP server — filesystem-direct, low context-tax.

This repo currently ships **just the measurement harness** that the eventual
server will be designed against. Two jobs in one tool:

1. **Profiler** — exact, fast facts about a vault (counts, bytes, link graph,
   frontmatter shape, tag distribution, freshness). Turns vault estimates into
   measured truth.
2. **Benchmark harness** — repeatable latency / payload-size / write-safety
   measurements against pluggable backends. Today: the **Obsidian Local REST
   API plugin**. Next: filesystem-direct, served by this repo.

Methodology is in version control so anyone can re-run and compare numbers.

---

## Quick start

```bash
# 1. Install deps
npm install

# 2. Point at your vault and run the profiler
export SEEKSTONE_VAULT="/path/to/your/Obsidian Vault"
npm run harness -- profile --vault "$SEEKSTONE_VAULT" --out reports
# → reports/vault-stats.json  (machine-readable)
# → reports/vault-stats.md    (human-readable)

# 3. Configure the REST adapter (Obsidian Local REST API plugin must be enabled)
export SEEKSTONE_REST_URL="https://127.0.0.1:27124"   # default
export SEEKSTONE_REST_API_KEY="<paste from the plugin settings tab>"

# 4. Edit packages/harness/queries/default.json to fit your vault, then bench
npm run harness -- bench \
  --queries packages/harness/queries/default.json \
  --stats reports/vault-stats.json \
  --out reports
# → reports/benchmark-rest.json
# → reports/benchmark-rest.md

# 5. Write-safety (two-step; runs on a COPY of the vault, never the live one)
npm run harness -- safety --vault "$SEEKSTONE_VAULT"
#   prints the scratch copy path and aborts
# Point Obsidian at that scratch copy (open it as a vault), then:
npm run harness -- safety \
  --vault "$SEEKSTONE_VAULT" \
  --copy-vault-root /tmp/seekstone-safety-XXXXXXXXXX \
  --out reports
# → reports/safety-rest.json
# → reports/safety-rest.md
```

---

## Methodology

The point of this repo is **reproducible numbers** that can be cited in a
write-up. The conventions are:

- **Snapshot the vault.** Record the date and (ideally) git-archive it
  alongside the report. Numbers from different snapshots are not comparable
  — the harness embeds `snapshotDate` in every output for traceability.
- **Pin the query set.** `packages/harness/queries/default.json` is the
  source of truth. Edit per-vault, commit, and re-run with the same file.
- **Capture machine specs.** The harness embeds `process.platform`,
  `process.arch`, `process.version`, and CPU count in every report. For an
  article-grade run, also record CPU model, RAM, and storage type in the
  README of your run.

### Benchmark conventions

- **N ≥ 20 runs** per measurement (configurable via `--runs`).
- **Cold** = run 1 (includes any one-time tax: TCP handshake, JIT, OS page
  cache miss, plugin index build).
- **Warm p50/p95** = runs 2..N (what a session actually feels like).
- **Payload bytes** = raw response body byte length. Token estimate is
  `bytes / 4` — close enough for context-tax ranking; replace with a
  `tiktoken` count if you need exact numbers.
- **TTFR.** For non-streaming adapters (the REST plugin), time-to-first-result
  equals the full response time. A streaming adapter should override and
  report TTFR separately.

### Write-safety conventions

- The harness **never writes to the live vault.** It copies the vault to a
  tmp scratch directory and refuses if the destination equals or sits
  inside the source path.
- The REST adapter writes to whatever vault Obsidian is currently pointing
  at. For safety tests you must open the scratch copy as a vault in Obsidian
  first, then point the harness at it with `--copy-vault-root`.
- Three ops per sampled note:
  - **identity** — write the original bytes back; expect byte-for-byte
    equality on disk after.
  - **body-append** — append a marker to the body; expect frontmatter region
    bytes to be unchanged and body to equal `original + marker`.
  - **fm-edit** — add a controlled frontmatter key via the `yaml`
    Document API; expect body bytes unchanged and existing FM key order
    preserved.

---

## Layout

```
seekstone/
├── packages/
│   └── harness/
│       ├── queries/default.json        ← version-controlled query set
│       └── src/
│           ├── cli.ts                  ← `profile` / `bench` / `safety` commands
│           ├── profiler/               ← vault walk, FM parse, link/tag extract
│           ├── bench/
│           │   ├── backend.ts          ← single interface every adapter implements
│           │   ├── adapters/rest.ts    ← Obsidian Local REST API plugin
│           │   ├── queries.ts          ← query set loader
│           │   ├── timer.ts            ← high-res timing, percentiles
│           │   └── runner.ts           ← orchestrator
│           ├── safety/                 ← vault copy + identity/append/fm-edit ops
│           └── util/percentiles.ts
└── reports/                            ← harness outputs land here (gitignored by default)
```

The eventual `packages/server` (the MCP server itself) will reuse the
profiler's walk/parse code and the same `Backend` interface — the harness
work compounds into the build.

---

## Adding a new backend

Implement `Backend` (see `packages/harness/src/bench/backend.ts`) and wire it
up in `cli.ts`. The interface is deliberately small — search / read / write /
list — and is the same surface the MCP server will expose.

---

## Roadmap

- [x] Profiler v1
- [x] Benchmark harness v1 with Obsidian Local REST API adapter
- [x] Write-safety v1
- [ ] Filesystem-direct adapter (`packages/server`)
- [ ] MCP transport
- [ ] Token counting via `tiktoken`
- [ ] Streaming search + TTFR measurement
