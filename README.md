# seekstone

[![CI](https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml/badge.svg)](https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js ≥ 22](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)

An Obsidian MCP server — filesystem-direct, low context-tax.

seekstone reads your vault **directly from disk** instead of routing through the Obsidian Local REST API plugin. The practical difference: a search that returns 1.75 MB and ~459,000 tokens via the REST plugin returns **3 KB and ~800 tokens** via seekstone — a 575× reduction. The payoff is that Claude can search and read notes without burning most of its context window on a single tool call.

## What's in this repo

| Package | Purpose |
|---|---|
| `packages/core` | Shared vault primitives — walk, frontmatter parser, link/tag extractor, percentiles |
| `packages/server` | The MCP server (8 tools, stdio transport, MiniSearch full-text index, FSEvents watcher) |
| `packages/harness` | Profiler + benchmark + write-safety harness with REST and fs backends |

---

## MCP server

### Tools

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked ~200-char excerpts, not full notes. Supports fuzzy, prefix, and phrase queries. |
| `read_note` | Read the full content of a note by vault-relative path. |
| `list_notes` | List notes, optionally filtered by folder prefix or tag. |
| `create_note` | Create a new note at a vault-relative path. Optionally sets frontmatter and body. Parent directories are created automatically. |
| `delete_note` | Permanently delete a note from the vault. |
| `move_note` | Move or rename a note to a new vault-relative path. Parent directories are created automatically. |
| `append_note` | Append text to a note body without touching the frontmatter. |
| `patch_frontmatter` | Set, update, or delete frontmatter keys while preserving key order and quote style. |

### Claude Desktop setup

```bash
npm install
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seekstone": {
      "command": "npx",
      "args": ["tsx", "/path/to/seekstone/packages/server/src/index.ts"],
      "env": {
        "SEEKSTONE_VAULT": "/path/to/your/Obsidian Vault"
      }
    }
  }
}
```

Restart Claude Desktop. On startup, seekstone walks the vault and builds a MiniSearch index (~1.3 s for ~2,000 notes). All eight tools are then available in Claude. An FSEvents watcher keeps the index in sync as notes are added, edited, or deleted while the server is running.

---

## Benchmark harness

The harness produces reproducible, citable numbers for the context-tax comparison. Methodology is version-controlled so re-runs against the same vault snapshot are directly comparable.

### Measured results (1,936-note vault, Apple M-series, Node v25)

| Query | REST warm p50 | fs warm p50 | REST payload | fs payload | Reduction |
|---|---:|---:|---:|---:|---:|
| `engineering` | 47 ms | 1.6 ms | 1.75 MB | 3.1 KB | **575×** |
| `team dynamics` | 57 ms | 2.9 ms | 1.28 MB | 3.2 KB | **409×** |
| `"radical candor"` | 24 ms | 1.0 ms | 0 hits | 10 hits | — ¹ |
| `excalidraw thumbnail` | 28 ms | 3.3 ms | 0 hits | 10 hits | — ¹ |

¹ The REST plugin returns 0 hits for phrase queries and certain multi-word queries — it does not support quoted-phrase syntax. seekstone (MiniSearch) handles both.

**Write safety** (25 notes, three ops each):

| Op | REST | seekstone |
|---|---|---|
| identity | ✅ 25/25 | ✅ 25/25 |
| body-append | ❌ 0/25 (silent data loss) | ✅ 25/25 |
| fm-edit | ✅ 25/25 | ✅ 25/25 |

The REST plugin returns HTTP 204 on body-append but silently discards the content. seekstone writes raw bytes directly and verifies them.

### Running the harness

```bash
npm install

# Required env vars
export SEEKSTONE_VAULT="/path/to/your/Obsidian Vault"

# Profile the vault (generates vault-stats.json used by bench to auto-pick read targets)
npx tsx packages/harness/src/cli.ts profile \
  --vault "$SEEKSTONE_VAULT" --out reports

# Benchmark — filesystem-direct (no other setup needed)
npx tsx packages/harness/src/cli.ts bench \
  --backend fs \
  --queries packages/harness/queries/default.json \
  --stats reports/vault-stats.json \
  --out reports

# Benchmark — Obsidian Local REST API plugin (Obsidian must be running with plugin enabled)
export SEEKSTONE_REST_API_KEY="<paste from plugin settings>"
npx tsx packages/harness/src/cli.ts bench \
  --backend rest \
  --queries packages/harness/queries/default.json \
  --stats reports/vault-stats.json \
  --out reports

# Write-safety — fs backend (single step, no Obsidian required)
npx tsx packages/harness/src/cli.ts safety \
  --vault "$SEEKSTONE_VAULT" \
  --backend fs \
  --out reports

# Write-safety — REST backend (two-step: copy vault, point Obsidian at the copy, then run)
npx tsx packages/harness/src/cli.ts safety --vault "$SEEKSTONE_VAULT"
#   prints the scratch copy path and exits
# Open that path as a vault in Obsidian, then:
npx tsx packages/harness/src/cli.ts safety \
  --vault "$SEEKSTONE_VAULT" \
  --backend rest \
  --copy-vault-root /tmp/seekstone-safety-XXXXXXXXXX \
  --out reports
```

Output files are written to `reports/` (gitignored — they contain vault-specific paths).

### Query set

`packages/harness/queries/default.json` is the pinned query set. Edit it for your vault (particularly the `rare` query — pick a term that exists but is uncommon), commit, and re-run to keep results comparable across snapshots and adapters.

### Methodology

- **N ≥ 20 runs** per measurement (override with `--runs`).
- **Cold** = run 1 — includes any one-time tax (TCP handshake, JIT, page-cache miss, index build).
- **Warm p50/p95** = runs 2..N — what a live session actually feels like.
- **Payload bytes** = raw response byte length as returned by the adapter. Token count uses tiktoken `cl100k_base`.
- The **write-safety harness never touches the live vault.** All write ops run against a scratch copy under `os.tmpdir()`, and the copy path is asserted to not equal or sit inside the original before any write runs.

---

## Development

```bash
npm install                                           # install all workspace deps
npm test                                              # vitest across all packages (237 tests)
npm run -w @seekstone/harness test                    # harness tests only
npx vitest run packages/server/src/tools/search.test.ts   # single file
npx vitest run -t 'parses a typical frontmatter'     # single test by name
npx tsc -p packages/harness/tsconfig.json --noEmit   # typecheck
npm run lint                                          # biome check
npm run format                                        # biome write
```

There is no build step — the project runs via `tsx`. `tsc` is typecheck-only.

### Required env vars

| Var | Used by | Required |
|---|---|---|
| `SEEKSTONE_VAULT` | Server, harness profile/safety | Always |
| `SEEKSTONE_REST_API_KEY` | Harness REST adapter | REST bench/safety only |
| `SEEKSTONE_REST_URL` | Harness REST adapter | Defaults to `https://127.0.0.1:27124` |

### Test coverage

237 tests across three packages, all co-located as `*.test.ts` next to source. Every exported function has at least one positive and one negative test.

| Package | Test files | Tests |
|---|---:|---:|
| core | 4 | 29 |
| harness | 16 | 131 |
| server | 11 | 77 |

Not covered by unit tests (integration/entry-point concerns): `cli.ts`, `server/index.ts` (MCP entry point), `rest.ts` (all methods require a live HTTP server).

---

## Repo layout

```
seekstone/
├── packages/
│   ├── core/                     ← shared primitives (no deps on harness or server)
│   │   └── src/
│   │       ├── walk.ts           ← vault walker, file classifier
│   │       ├── frontmatter.ts    ← byte-aware YAML frontmatter parser
│   │       ├── extract.ts        ← wikilink / URL / tag extractors
│   │       └── percentiles.ts    ← Distribution type, summarise()
│   ├── harness/
│   │   ├── queries/default.json  ← version-controlled query set
│   │   └── src/
│   │       ├── cli.ts            ← profile / bench / safety commands
│   │       ├── profiler/         ← vault profiler (counts, sizes, links, tags)
│   │       ├── bench/
│   │       │   ├── backend.ts    ← Backend interface (search/read/write/list)
│   │       │   ├── adapters/
│   │       │   │   ├── rest.ts   ← Obsidian Local REST API plugin adapter
│   │       │   │   └── fs.ts     ← Filesystem-direct adapter (MiniSearch)
│   │       │   ├── runner.ts     ← benchmark orchestrator
│   │       │   └── timer.ts      ← high-res timing, cold/warm distributions
│   │       └── safety/           ← vault copy, identity/append/fm-edit ops
│   └── server/
│       └── src/
│           ├── index.ts          ← MCP server entry point (stdio)
│           ├── context.ts        ← ServerContext type
│           ├── watcher.ts        ← FSEvents hot-reload watcher
│           ├── index/
│           │   ├── build.ts      ← MiniSearch index builder
│           │   ├── doc.ts        ← buildDoc / upsertDoc helpers
│           │   ├── excerpt.ts    ← ~200-char excerpt extractor
│           │   └── types.ts      ← IndexedNote, SearchHit
│           └── tools/
│               ├── search.ts
│               ├── read_note.ts
│               ├── list_notes.ts
│               ├── create_note.ts
│               ├── delete_note.ts
│               ├── move_note.ts
│               ├── append_note.ts
│               └── patch_frontmatter.ts
└── reports/                      ← harness outputs (gitignored)
```

### Key design notes

**Frontmatter parsing is byte-aware.** `parseFrontmatter` returns `bodyStart` as a byte offset so write operations can prove the FM region is byte-identical before and after. Never route reads through `yaml.stringify` to "normalise" — that destroys the round-trip contract.

**Module imports use `.js` extensions** throughout, even when importing `.ts` source. That's what NodeNext + tsx + tsc all agree on.

**`Distribution`** (`min`/`median`/`p90`/`p95`/`p99`/`max`/`mean`) is the single percentile shape across the codebase. Any new metric should go through `summarise()`.

**Reports are deterministic** for a fixed vault snapshot. The safety sample is selected by sorting lexically then striding, so the same 25 notes are picked on every run. No `Math.random()` in profiler or safety paths.

---

## Adding a backend

Implement `Backend` in `packages/harness/src/bench/adapters/`. Wire it up in `cli.ts`'s `buildBackend()`. Reports automatically use the adapter's `name` field for output filenames (`benchmark-<name>.{json,md}`, `safety-<name>.{json,md}`).

---

## Roadmap

- [x] Profiler
- [x] Benchmark harness — REST adapter
- [x] Write-safety suite
- [x] Filesystem-direct adapter (harness)
- [x] MCP server (8 tools, stdio transport)
- [x] Claude Desktop integration
- [x] Index hot-reload on vault change (FSEvents watcher)
- [x] Test suite (237 tests)
- [x] Token counting via tiktoken `cl100k_base`
- [ ] Streaming search + TTFR measurement
