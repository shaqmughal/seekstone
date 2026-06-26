# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-26T01:55:10.351Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 572.30 MB, peak 615.84 MB (Δ 43.55 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.09 ms | 0.90 ms | 1.69 ms | 0.85 ms | 0.71 ms | 3.0 KB | 847 | 10 |
| `Roman Empire` | multi | 2.91 ms | 2.02 ms | 2.64 ms | 2.22 ms | 1.93 ms | 3.2 KB | 896 | 10 |
| `the capital of` | phrase | 13.18 ms | 9.01 ms | 10.62 ms | 9.13 ms | 8.63 ms | 2.8 KB | 778 | 10 |
| `phlogiston` | rare | 1.60 ms | 0.78 ms | 0.96 ms | 0.78 ms | 0.74 ms | 1.3 KB | 356 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.93 ms | 0.18 ms | 0.23 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.30 ms | 1.23 ms | 1.35 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 3.19 ms | 0.29 ms | 0.32 ms | 26.8 KB |
| `list_tags` | all tags | 1.80 ms | 0.92 ms | 1.08 ms | 11.0 KB |
| `outline_note` | `Encyclopedia/H/Hoole.md` | 0.53 ms | 0.09 ms | 0.13 ms | 234 B |
| `get_backlinks` | `Encyclopedia/H/Hoole.md` | 0.08 ms | 0.01 ms | 0.02 ms | 61 B |
| `get_links` | `Encyclopedia/H/Hoole.md` | 3.93 ms | 3.74 ms | 4.22 ms | 552 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
