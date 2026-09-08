# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-09-07T03:42:41.035Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.64 MB, peak 198.64 MB (Δ 46.00 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2758.30 ms | 2652.42 ms | 2726.58 ms | — | — | 8.5 KB | 2,372 | 50 |
| `Roman Empire` | multi | 2669.07 ms | 2684.78 ms | 2772.50 ms | — | — | 7.7 KB | 2,336 | 50 |
| `the capital of` | phrase | 2674.13 ms | 2683.77 ms | 2757.82 ms | — | — | 7.9 KB | 2,440 | 50 |
| `phlogiston` | rare | 2684.74 ms | 2645.01 ms | 2771.02 ms | — | — | 4.8 KB | 1,422 | 30 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 2.96 ms | 0.50 ms | 2.64 ms | 4.5 KB |
| large | `Encyclopedia/I/Italy.md` | 17.37 ms | 16.17 ms | 21.07 ms | 1.56 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 34.61 ms | 31.17 ms | 33.42 ms | 13.8 KB |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
