# Benchmark — rest

- **Adapter:** Obsidian Local REST API plugin (HTTP round-trip)
- **Snapshot:** 2026-06-26T03:25:45.985Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 147.70 MB, peak 688.61 MB (Δ 540.91 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 50.29 ms | 12.80 ms | 19.22 ms | — | — | 289.6 KB | 78,224 | 223 |
| `Roman Empire` | multi | 21.41 ms | 18.56 ms | 22.08 ms | — | — | 208.5 KB | 55,458 | 44 |
| `the capital of` | phrase | 233.66 ms | 198.71 ms | 210.74 ms | — | — | 25.40 MB | 6,826,942 | 113 |
| `phlogiston` | rare | 30.31 ms | 9.00 ms | 12.81 ms | — | — | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.95 ms | 0.69 ms | 1.24 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 2.37 ms | 1.73 ms | 3.30 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 1.62 ms | 0.44 ms | 0.67 ms | 225 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
