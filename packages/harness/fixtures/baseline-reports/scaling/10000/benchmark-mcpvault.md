# Benchmark — mcpvault

- **Adapter:** mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)
- **Snapshot:** 2026-06-26T01:57:11.836Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.61 MB, peak 161.63 MB (Δ 11.02 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 947.78 ms | 870.66 ms | 914.63 ms | — | — | 2.3 KB | 714 | 10 |
| `Roman Empire` | multi | 1200.53 ms | 1073.26 ms | 1182.32 ms | — | — | 2.2 KB | 711 | 10 |
| `the capital of` | phrase | 1198.21 ms | 1114.42 ms | 1202.78 ms | — | — | 2.2 KB | 745 | 10 |
| `phlogiston` | rare | 864.18 ms | 826.68 ms | 864.63 ms | — | — | 2.1 KB | 650 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.25 ms | 0.32 ms | 0.39 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 8.64 ms | 5.50 ms | 6.14 ms | 794.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 1.09 ms | 0.27 ms | 0.51 ms | 165 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
