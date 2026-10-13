# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-10-12T23:08:16.523Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 156.98 MB, peak 232.20 MB (Δ 75.22 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1396.79 ms | 1366.47 ms | 1410.30 ms | — | — | 8.3 KB | 2,386 | 50 |
| `Roman Empire` | multi | 1435.52 ms | 1390.42 ms | 1400.07 ms | — | — | 8.1 KB | 2,442 | 50 |
| `the capital of` | phrase | 1452.24 ms | 1397.47 ms | 1440.59 ms | — | — | 8.0 KB | 2,500 | 50 |
| `phlogiston` | rare | 1367.07 ms | 1366.03 ms | 1373.50 ms | — | — | 2.7 KB | 784 | 17 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.85 ms | 0.54 ms | 2.47 ms | 4.4 KB |
| large | `Encyclopedia/I/Italy.md` | 12.59 ms | 11.93 ms | 13.41 ms | 1.56 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 17.15 ms | 12.30 ms | 14.09 ms | 14.1 KB |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
