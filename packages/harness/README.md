# @seekstone/harness

Dev-only measurement harness for the seekstone Obsidian MCP server: a **profiler**, a
**benchmark runner**, a **write-safety suite**, and a **retrieval-quality eval**. The
first three share one `Backend` contract so filesystem-direct, REST, and other adapters
are measured identically; the retrieval eval deliberately bypasses `Backend` and calls
the server's search internals directly — it measures ranking quality, not payload bytes.
Run from source via `tsx`; never published to npm.

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

# retrieval quality (needs the models once: npm run harness -- fetch-models).
# This exact invocation produced the committed retrieval-eval.{json,md} baseline:
npm run harness -- retrieval --model potion-retrieval-32M,potion-base-8M --shipped --split all --out "$OUT"
# (32M first so the shipped-search conditions exercise the opt-in model; both models still score in-harness)

# competitor semantic comparison (SHA-308) — produced retrieval-eval-competitors.{json,md}.
# Needs a local Ollama serving nomic-embed-text (both competitors delegate embeddings to it):
#   brew install ollama && ollama serve & && ollama pull nomic-embed-text
npm run harness -- retrieval --model potion-base-8M --runs 5 --shipped --competitors --out "$OUT"
```

Committed baseline outputs live in [`fixtures/baseline-reports/`](./fixtures/baseline-reports).
**Payload bytes/tokens are deterministic** (they don't depend on the machine) and are the
headline "context tax" metric; latency numbers are machine-specific, so reproduce the
*methodology*, not the exact milliseconds. The retrieval baseline follows the same split:
hit@5/MRR@10 are deterministic for a fixed vault + model + golden set, while its warm-p95
latency (and therefore the gate's ≤ 15 ms clause) is machine-specific.

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
- `fetch-models` follows the same committed-manifest pattern for the Model2Vec embedding
  models: [`fixtures/models/manifest.json`](./fixtures/models/manifest.json) pins URLs +
  SHA-256 per file, payloads land gitignored under `fixtures/models/`, and a manifest
  entry with `sha256: "TBD"` downloads, prints the computed hash, and refuses to proceed
  until the pin is committed.

If you regenerate with a different `--count`/`--seed`, the vault changes — re-measure the
query terms in [`queries/default.json`](./queries/default.json), update the profile
snapshot (`npx vitest -u`), fix [`queries/golden.json`](./queries/golden.json) (its
150 retrieval queries name concrete vault paths; `src/retrieval/golden.test.ts` hard-fails
on any that vanish — by design), and regenerate the baseline reports.

### Drift guard

[`src/fixtures/profile-fixture.test.ts`](./src/fixtures/profile-fixture.test.ts) profiles
the committed vault and snapshots its content-derived shape (sizes, links, frontmatter,
tags — stripping machine/time/freshness fields). If the committed vault ever changes
without the snapshot being updated, CI fails. This is the guarantee that **the benchmark
target can't silently drift.**

> **Freshness note.** The profiler's "modified in last N days" stats are `now − mtime`;
> for a checked-out fixture mtime is the checkout time, so freshness is **not meaningful**
> for the vault. It is a descriptive profile stat, not a benchmark metric.

## Multi-scale scaling showcase (SHA-189)

`fixtures/baseline-reports/scaling/benchmark-scaling.md` compares every adapter
across **1k / 5k / 10k** vaults — the headline artifact showing that seekstone
stays flat (~1–8 ms, ~2–3 KB per search) as the vault grows while REST-proxy and
full-scan servers climb with it. All three vaults are committed
(`fixtures/vault-1k`, `vault-5k`, `vault`), each with its own query set in
`queries/`.

### Regenerate the automated adapters (headless)

```bash
R="$PWD/packages/harness/fixtures/baseline-reports/scaling"
declare -A V=( [1000]=vault-1k [5000]=vault-5k [10000]=vault )
declare -A Q=( [1000]=vault-1k.json [5000]=vault-5k.json [10000]=default.json )
for size in 1000 5000 10000; do
  for b in seekstone fs mcpvault obsidian-mcp-rs obsidian-tc; do
    npm run harness -- bench --backend "$b" \
      --vault   "$PWD/packages/harness/fixtures/${V[$size]}" \
      --queries "$PWD/packages/harness/queries/${Q[$size]}" \
      --out "$R/$size"
  done
done
npm run harness -- scale-render --dir "$R"   # → benchmark-scaling.md
```

`obsidian-mcp` and `obsidian-mcp-pro` are filesystem-direct but currently excluded
(slow synchronous init at scale; a read-path quirk respectively) — raise
`SEEKSTONE_MCP_INIT_TIMEOUT` to give the former more headroom.

`obsidian-tc` notes: it requires **Node ≥ 24**, and it persists its SQLite index
in `~/.obsidian-tc/` (not inside the vault) — `rm -rf ~/.obsidian-tc` before a
run to measure a true cold start, otherwise run 1 reuses the previous index.
The adapter boots it from a generated config that raises
`governor.maxResponseBytes` from the 1 MB default to 100 MB — the default
refuses large-note reads outright (its read envelope carries the note text
twice), which would crash the read-large measurement instead of measuring it;
everything else stays at server defaults. Set `SEEKSTONE_OBSIDIAN_TC_FACADE=1`
to bench the same ops through its `call_capability` meta-tool facade instead of
direct calls (reported as `obsidian-tc-facade`).

### Capturing the Obsidian REST servers (manual, 3 sessions)

`rest`, `mcp-obsidian`, and `obsidian-mcp-server` proxy **Obsidian's Local REST
API**, so they need Obsidian running with the plugin enabled and pointed at the
vault. This can't be automated headlessly. Do **one session per vault size** —
each captures all three:

```bash
# 1. Open Obsidian on the vault for this size (e.g. fixtures/vault-5k),
#    enable the Local REST API plugin, and copy its API key.
export SEEKSTONE_REST_API_KEY="<key from the plugin settings tab>"

size=5000; vault=vault-5k; qs=vault-5k.json     # repeat for 1000/vault-1k and 10000/vault/default.json
R="$PWD/packages/harness/fixtures/baseline-reports/scaling"
for b in rest mcp-obsidian obsidian-mcp-server; do
  npm run harness -- bench --backend "$b" \
    --queries "$PWD/packages/harness/queries/$qs" --out "$R/$size"
done

# 2. After all three sessions, merge the captures into the showcase:
npm run harness -- scale-render --dir "$R"
```

Commit the captured `benchmark-{rest,mcp-obsidian,obsidian-mcp-server}.json` with a
note of the date + Obsidian/plugin versions. The renderer merges whatever is
present and lists anything still missing under "Not yet captured."

## The tools

| Command | What it does | Output |
| --- | --- | --- |
| `profile` | Walks the vault, classifies files, aggregates note/link/tag/frontmatter stats | `vault-stats.{json,md}` |
| `bench`   | Runs the query set against a `--backend` (`fs`, `rest`, …), capturing latency **and payload bytes/tokens** | `benchmark-<backend>.{json,md}` |
| `scenarios` | Tokens-per-task: runs each task in `queries/tasks.json` as the call sequence an agent would make (one `context_pack` call where supported, else search → read ×K → backlinks) and sums payload across it | `scenarios-<label>.{json,md}` |
| `scenarios-compare` | Cross-adapter tokens-per-task table from scenario JSONs | `scenarios-comparison.md` |
| `safety`  | Write-safety suite (operates on a vault **copy**): five byte-faithful round-trip ops plus three behavioral ops — recoverable-delete, create-no-clobber, cas-conflict | `safety-<backend>.{json,md}` |
| `compare` | Cross-adapter comparison from benchmark JSONs | `comparison.md` |
| `gen-vault` | Regenerates the committed synthetic vault from the corpus (deterministic, `--seed 42`, `--count 10000`) | `fixtures/vault/` |
| `fetch-corpus` | Downloads the PG EB1911 corpus into `fixtures/corpus/raw/` (gitignored) | corpus text |
| `fetch-models` | Downloads the pinned Model2Vec embedding models into `fixtures/models/` (gitignored), checksum-verified against [`fixtures/models/manifest.json`](./fixtures/models/manifest.json) | model files |
| `retrieval` | Retrieval-quality eval against `queries/golden.json`: lexical vs semantic (per model) vs hybrid, hit@5 + MRR@10 per subset, warm latency, and the pre-registered SHA-257 ship gate. `--experiments` adds the fusion candidates (reported, never gated); `--shipped` reruns every query through the server's real `search` tool and the real per-vault embedding cache — the one harness path that writes outside the repo (`SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone`) | `retrieval-eval.{json,md}` |
| `scale-render` | Renders the multi-scale (1k/5k/10k) comparison report from per-size benchmark JSONs | `benchmark-scaling.md` |

`bench` and `scenarios` accept `--runs <n>` (default 20) — the run count behind the cold/warm split quoted in the reports. `retrieval` takes `--runs` too (default 20), but with different semantics: run 1 per query is cold and discarded, and only the pooled warm distribution is reported. Each subprocess adapter's launch command can be overridden with `SEEKSTONE_<NAME>_CMD` (e.g. `SEEKSTONE_MCPVAULT_CMD`), matching the `SEEKSTONE_<NAME>_*` env convention.

### Tokens per task (`scenarios`)

`queries/tasks.json` is a methodology artifact like the query set: each task is one
question an agent must gather context to answer. The runner picks the cheapest
sequence the backend supports — backends with `context_pack` answer in one call;
everything else pays for `search` → `read` per top hit → `get_backlinks`, with reads
following **that backend's own** hit ranking. Payload bytes and (encoder-approximate,
tiktoken `cl100k_base`) tokens are summed per task; latency is whole-task cold/warm.
`--strategy multicall` forces a context_pack-capable backend down the multi-call path
(reported as `<name>-multicall`) — the ablation that shows the win is `context_pack`
itself, not the adapter. Committed baselines live in
`fixtures/baseline-reports/scenarios-*.{json,md}` + `scenarios-comparison.md`.

See the root [`CLAUDE.md`](../../CLAUDE.md) for architecture details (the `Backend`
contract, percentile shapes, write-safety guard rails) and required env vars for the
`rest` backend.

## Tests

```bash
npm run -w @seekstone/harness test          # vitest (incl. parser + vault drift guard)
npx tsc -p packages/harness/tsconfig.json --noEmit
```
