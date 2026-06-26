# @seekstone/harness

Dev-only measurement harness for the seekstone Obsidian MCP server: a **profiler**, a
**benchmark runner**, and a **write-safety suite**, all sharing one `Backend` contract so
filesystem-direct, REST, and other adapters are measured identically. Run from source via
`tsx`; never published to npm.

> The product story this harness exists to substantiate: **filesystem-direct beats
> REST-proxy, and the win is mostly payload size ("context tax"), not raw CPU.**

## The benchmark vault (read this first)

Benchmarks run against a **committed synthetic vault** at
[`fixtures/vault/`](./fixtures/vault) — **10,000 notes** generated from the public-domain
**1911 Encyclopædia Britannica** (via Project Gutenberg).

**Why synthetic and committed?**

- **Reproducible.** A personal vault changes over time, so its numbers drift and nobody
  else can rerun them. Profiling/benchmarking is deterministic from file contents, so a
  fixed, committed vault yields stable numbers anyone can reproduce.
- **No private data.** Earlier numbers came from a personal Obsidian vault. The synthetic
  vault removes that dependency entirely — there is no personal data to leak.
- **Realistic shape.** EB1911's article-size distribution closely matches a real PKM
  vault (median ~2 KB note, long tail to ~800 KB), and the generator adds frontmatter
  (~59%), wikilinks (~37% intentionally unresolved), tags, and external URLs to mirror a
  real vault's structure. It reads as a research/reference vault.

The vault is the **canonical committed artifact** — running the benchmark needs nothing
else. The source corpus is only needed to *regenerate* it.

### Run the suite against the fixture

```bash
npm install
V="$PWD/packages/harness/fixtures/vault"
OUT="$PWD/packages/harness/fixtures/baseline-reports"

npm run harness -- profile --vault "$V" --out "$OUT"
npm run harness -- bench   --backend fs --vault "$V" --stats "$OUT/vault-stats.json" --out "$OUT"
npm run harness -- safety  --backend fs --vault "$V" --sample 25 --out "$OUT"
```

Committed baseline outputs live in [`fixtures/baseline-reports/`](./fixtures/baseline-reports).
**Payload bytes/tokens are deterministic** (they don't depend on the machine) and are the
headline "context tax" metric; latency numbers are machine-specific, so reproduce the
*methodology*, not the exact milliseconds.

### Regenerate the vault (only if you change it)

```bash
npm run harness -- fetch-corpus              # download + checksum-verify PG EB1911 volumes
npm run harness -- gen-vault --count 10000   # deterministic; same corpus+count+seed → identical vault
```

- `fetch-corpus` reads [`fixtures/corpus/manifest.json`](./fixtures/corpus/manifest.json)
  (pinned ebook IDs + SHA-256) and downloads the raw volume text to
  `fixtures/corpus/raw/` (gitignored). Checksums guarantee byte-identical input.
- `gen-vault` is seeded (`--seed`, default 42) and uses no `Math.random`, so output is
  fully deterministic. Provenance + public-domain status:
  [`fixtures/corpus/PROVENANCE.md`](./fixtures/corpus/PROVENANCE.md).

If you regenerate with a different `--count`/`--seed`, the vault changes — re-measure the
query terms in [`queries/default.json`](./queries/default.json), update the golden
snapshot (`npx vitest -u`), and regenerate the baseline reports.

### Drift guard

[`src/fixtures/profile-fixture.test.ts`](./src/fixtures/profile-fixture.test.ts) profiles
the committed vault and snapshots its content-derived shape (sizes, links, frontmatter,
tags — stripping machine/time/freshness fields). If the committed vault ever changes
without the snapshot being updated, CI fails. This is the guarantee that **the benchmark
target can't silently drift.**

> **Freshness note.** The profiler's "modified in last N days" stats are `now − mtime`;
> for a checked-out fixture mtime is the checkout time, so freshness is **not meaningful**
> for the vault. It is a descriptive profile stat, not a benchmark metric.

## The three tools

| Command | What it does | Output |
| --- | --- | --- |
| `profile` | Walks the vault, classifies files, aggregates note/link/tag/frontmatter stats | `vault-stats.{json,md}` |
| `bench`   | Runs the query set against a `--backend` (`fs`, `rest`, …), capturing latency **and payload bytes/tokens** | `benchmark-<backend>.{json,md}` |
| `safety`  | Byte-faithful write round-trip suite (operates on a vault **copy**) | `safety-<backend>.{json,md}` |
| `compare` | Cross-adapter comparison from benchmark JSONs | `comparison.md` |

See the root [`CLAUDE.md`](../../CLAUDE.md) for architecture details (the `Backend`
contract, percentile shapes, write-safety guard rails) and required env vars for the
`rest` backend.

## Tests

```bash
npm run -w @seekstone/harness test          # vitest (incl. parser + vault drift guard)
npx tsc -p packages/harness/tsconfig.json --noEmit
```
