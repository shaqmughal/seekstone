# SHA-322 — competitor head-to-head on fixture v2 (2026-09-06)

Canon-v2 companion to the committed `retrieval-eval-competitors.{json,md}`
(one run: `SEEKSTONE_COMPETITOR_INDEX_TIMEOUT_MS=10800000 npm run harness --
retrieval --model potion-retrieval-32M,potion-base-8M --runs 5 --shipped
--competitors --split all`). Fixture v2 gives the vault a real prose link
graph for the first time — the point was to re-judge graph-based retrieval
fairly in both directions, and it did.

## Results (150 queries; holdout n=60)

| Condition | Overall | Semantic | Topical | Holdout | Warm p50 | Warm p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| seekstone shipped (8M default) | 83.3% | 84.4% | 63.3% | 86.7% | — | 33–60 ms |
| seekstone shipped (32M) | 86.7% | 92.2% | 56.7% | 86.7% | — | 64–92 ms |
| obsidian-tc semantic | 88.7% | 93.3% | 63.3% | 90.0% | ~166 ms | 178 ms |
| obsidian-tc GraphRAG | **93.3%** | **97.8%** | **73.3%** | **95.0%** | 2.89 s | 4.17 s |
| obsidian-mcp-pro | FAILED | — | — | — | — | — |

- **GraphRAG earns its keep on a real graph.** On v1's random links its +2
  over tc's own semantic was flagged as likely noise
  ([EXPANSION-SHA-315.md](./EXPANSION-SHA-315.md)). On v2 the margin is
  **+4.6 overall / +10.0 topical** — real, and the v1 caveat is settled in
  tc's favor. The cost also grew: warm median 2.89 s and p95 4.17 s per
  query (v1: 2.7 s p50), with a p99 in the minutes — one query exhausted
  three 300 s attempts and scored as a miss (the run's only one; latency
  tail includes those retries by design).
- **The gate-v2 clauses recompute to the same FAIL** as SHA-316 on this
  canon: holdout 86.7 vs 95.0, and shipped warm p95 91.7 ms vs the 30 ms
  budget (p95 measured while Ollama served the competitors; the quiet-machine
  canon in `retrieval-eval.{json,md}` is the latency reference). No
  pre-registered gate ran here — gate v3 remains its own future event.
- **obsidian-mcp-pro cannot index this vault: `Invalid string length`** —
  the V8 string-ceiling crash reproduced on v2 (v1: same class). Three
  attempts this canon (two multi-hour timeouts under a 1–3 h budget, then
  the definitive crash at 1,020 s).
- **Index-cost correction (against ourselves).** Two early tc runs indexed
  in ~1.9–1.94 h with repeated internal retryable timeouts, suggesting a
  4.4× blowup vs v1. The definitive quiet run indexed in **1,814 s (30 min,
  one call)** — in line with v1's 26.5 min. The blowup was harness-side
  contention (each slow run followed mcp-pro's hours of Ollama churn), not
  graph density. The retry/resume hardening those runs motivated stays: tc's
  `operation_timeout … (retryable)` errors are real under load, and the
  adapter now honors them at index and query time.

## Reading it for the messaging doc

The speed/quality trade is now sharper and cleaner than v1: tc-graph is
+8.3 pts on holdout over our best shipped mode, at ~45–125× our query
latency, an external Ollama dependency, native modules, and a 30-min cold
index (ours: 25–35 s). Cite their quality win with its costs, ours with
theirs — same rule as always.
