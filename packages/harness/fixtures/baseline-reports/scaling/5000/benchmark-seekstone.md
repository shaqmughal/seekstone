# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-27T01:50:22.692Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 580.59 MB, peak 650.41 MB (Δ 69.81 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.08 ms | 0.75 ms | 1.01 ms | 0.84 ms | 0.71 ms | 2.1 KB | 569 | 10 |
| `Roman Empire` | multi | 3.09 ms | 2.01 ms | 2.51 ms | 2.13 ms | 1.90 ms | 2.2 KB | 627 | 10 |
| `the capital of` | phrase | 13.50 ms | 8.84 ms | 10.74 ms | 8.42 ms | 9.59 ms | 2.0 KB | 583 | 10 |
| `phlogiston` | rare | 1.81 ms | 0.78 ms | 0.85 ms | 0.83 ms | 0.74 ms | 853 B | 246 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.51 ms | 0.07 ms | 0.15 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.02 ms | 0.99 ms | 1.06 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.50 ms | 0.14 ms | 0.27 ms | 26.8 KB |
| `list_tags` | all tags | 1.59 ms | 0.93 ms | 1.06 ms | 11.0 KB |
| `outline_note` | `Encyclopedia/H/Hoole.md` | 3.24 ms | 0.09 ms | 0.19 ms | 234 B |
| `get_backlinks` | `Encyclopedia/H/Hoole.md` | 0.12 ms | 0.00 ms | 0.02 ms | 61 B |
| `get_links` | `Encyclopedia/H/Hoole.md` | 4.02 ms | 3.80 ms | 4.69 ms | 552 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
