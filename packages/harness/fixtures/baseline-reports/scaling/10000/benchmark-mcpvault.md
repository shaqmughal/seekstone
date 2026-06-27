# Benchmark — mcpvault

- **Adapter:** mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)
- **Snapshot:** 2026-06-27T01:53:27.110Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 149.86 MB, peak 170.20 MB (Δ 20.34 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1204.92 ms | 833.32 ms | 887.82 ms | — | — | 2.3 KB | 714 | 10 |
| `Roman Empire` | multi | 1119.97 ms | 1060.90 ms | 1069.36 ms | — | — | 2.2 KB | 711 | 10 |
| `the capital of` | phrase | 1099.28 ms | 1106.71 ms | 1149.14 ms | — | — | 2.2 KB | 745 | 10 |
| `phlogiston` | rare | 824.61 ms | 831.59 ms | 868.10 ms | — | — | 2.1 KB | 650 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.26 ms | 0.30 ms | 0.40 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 8.42 ms | 5.30 ms | 7.18 ms | 794.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 3.14 ms | 0.32 ms | 0.61 ms | 165 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
