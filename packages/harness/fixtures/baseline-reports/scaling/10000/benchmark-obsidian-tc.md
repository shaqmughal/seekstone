# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-10-12T23:12:17.115Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 157.27 MB, peak 195.97 MB (Δ 38.70 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2895.68 ms | 2834.46 ms | 2876.45 ms | — | — | 8.5 KB | 2,405 | 50 |
| `Roman Empire` | multi | 2857.15 ms | 2873.52 ms | 2914.15 ms | — | — | 7.7 KB | 2,339 | 50 |
| `the capital of` | phrase | 2843.26 ms | 2861.66 ms | 2923.98 ms | — | — | 7.9 KB | 2,442 | 50 |
| `phlogiston` | rare | 2851.14 ms | 2824.41 ms | 2867.19 ms | — | — | 4.9 KB | 1,426 | 30 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.83 ms | 0.48 ms | 0.60 ms | 4.5 KB |
| large | `Encyclopedia/I/Italy.md` | 14.04 ms | 12.34 ms | 17.55 ms | 1.56 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 32.56 ms | 25.69 ms | 28.21 ms | 13.8 KB |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
