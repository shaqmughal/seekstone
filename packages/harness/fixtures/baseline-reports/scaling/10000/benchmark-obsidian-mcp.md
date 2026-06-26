# Benchmark — obsidian-mcp

- **Adapter:** obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:53:30.582Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 149.86 MB, peak 175.03 MB (Δ 25.17 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 909.43 ms | 825.42 ms | 843.38 ms | — | — | 733.8 KB | 199,850 | 0 |
| `Roman Empire` | multi | 835.26 ms | 803.75 ms | 813.94 ms | — | — | 23.6 KB | 6,518 | 0 |
| `the capital of` | phrase | 833.05 ms | 838.69 ms | 847.63 ms | — | — | 45.1 KB | 13,544 | 0 |
| `phlogiston` | rare | 777.58 ms | 776.59 ms | 785.19 ms | — | — | 2.7 KB | 730 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 0.63 ms | 0.21 ms | 0.23 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 3.73 ms | 3.62 ms | 3.71 ms | 781.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.29 ms | 0.09 ms | 0.14 ms | 27 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
