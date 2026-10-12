# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-10-12T23:01:50.597Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 157.14 MB, peak 194.97 MB (Δ 37.83 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 289.31 ms | 275.76 ms | 286.41 ms | — | — | 8.1 KB | 2,383 | 50 |
| `Roman Empire` | multi | 277.69 ms | 274.58 ms | 287.87 ms | — | — | 4.4 KB | 1,297 | 27 |
| `the capital of` | phrase | 288.09 ms | 272.04 ms | 278.66 ms | — | — | 6.1 KB | 1,870 | 38 |
| `phlogiston` | rare | 271.20 ms | 271.35 ms | 280.43 ms | — | — | 56 B | 17 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.78 ms | 0.51 ms | 3.52 ms | 4.2 KB |
| large | `Encyclopedia/E/English Law.md` | 5.99 ms | 5.56 ms | 7.92 ms | 792.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 5.29 ms | 3.29 ms | 3.96 ms | 14.7 KB |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
