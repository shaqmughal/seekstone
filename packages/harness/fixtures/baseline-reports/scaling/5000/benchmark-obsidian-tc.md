# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-09-07T03:25:44.184Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 153.05 MB, peak 198.19 MB (Δ 45.14 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1272.58 ms | 1242.04 ms | 1275.44 ms | — | — | 8.3 KB | 2,369 | 50 |
| `Roman Empire` | multi | 1301.93 ms | 1267.85 ms | 1325.76 ms | — | — | 8.1 KB | 2,449 | 50 |
| `the capital of` | phrase | 1258.67 ms | 1299.95 ms | 1417.35 ms | — | — | 8.0 KB | 2,490 | 50 |
| `phlogiston` | rare | 1361.36 ms | 1203.93 ms | 1346.21 ms | — | — | 2.7 KB | 784 | 17 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.81 ms | 0.56 ms | 2.59 ms | 4.4 KB |
| large | `Encyclopedia/I/Italy.md` | 15.63 ms | 13.97 ms | 14.83 ms | 1.56 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 16.69 ms | 11.69 ms | 13.08 ms | 14.1 KB |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
