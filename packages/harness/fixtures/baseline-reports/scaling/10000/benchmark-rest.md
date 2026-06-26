# Benchmark — rest

- **Adapter:** Obsidian Local REST API plugin (HTTP round-trip)
- **Snapshot:** 2026-06-26T02:30:24.313Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 147.42 MB, peak 3750.00 MB (Δ 3602.58 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1104.95 ms | 126.05 ms | 130.39 ms | — | — | 3.17 MB | 872,230 | 2226 |
| `Roman Empire` | multi | 209.99 ms | 160.74 ms | 161.95 ms | — | — | 1.75 MB | 478,372 | 453 |
| `the capital of` | phrase | 2012.07 ms | 1926.94 ms | 1951.61 ms | — | — | 245.37 MB | 65,770,953 | 1105 |
| `phlogiston` | rare | 121.03 ms | 85.50 ms | 95.67 ms | — | — | 11.8 KB | 3,141 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 2.80 ms | 0.45 ms | 0.64 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 2.36 ms | 2.29 ms | 3.01 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 3.92 ms | 1.48 ms | 3.46 ms | 225 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
