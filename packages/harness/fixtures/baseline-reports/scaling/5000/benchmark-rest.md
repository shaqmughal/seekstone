# Benchmark — rest

- **Adapter:** Obsidian Local REST API plugin (HTTP round-trip)
- **Snapshot:** 2026-06-26T03:11:51.566Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 146.97 MB, peak 1945.28 MB (Δ 1798.31 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 591.48 ms | 61.11 ms | 62.81 ms | — | — | 1.66 MB | 455,614 | 1091 |
| `Roman Empire` | multi | 105.31 ms | 79.58 ms | 83.01 ms | — | — | 895.0 KB | 238,229 | 223 |
| `the capital of` | phrase | 975.84 ms | 918.24 ms | 952.19 ms | — | — | 116.95 MB | 31,344,036 | 551 |
| `phlogiston` | rare | 78.19 ms | 44.74 ms | 53.93 ms | — | — | 6.3 KB | 1,672 | 3 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 2.13 ms | 0.65 ms | 1.19 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 5.09 ms | 2.89 ms | 5.58 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 3.39 ms | 0.94 ms | 1.98 ms | 292 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
