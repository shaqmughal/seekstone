# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-26T01:55:14.776Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 510.56 MB, peak 541.14 MB (Δ 30.58 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.20 ms | 1.06 ms | 1.37 ms | 0.76 ms | 0.67 ms | 2.7 KB | 758 | 10 |
| `Roman Empire` | multi | 3.28 ms | 2.18 ms | 2.84 ms | 1.19 ms | 1.06 ms | 2.7 KB | 770 | 10 |
| `the capital of` | phrase | 13.23 ms | 9.05 ms | 10.04 ms | 7.08 ms | 6.89 ms | 2.7 KB | 770 | 10 |
| `phlogiston` | rare | 1.82 ms | 0.95 ms | 2.09 ms | 0.95 ms | 0.91 ms | 1.1 KB | 301 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.56 ms | 0.25 ms | 0.29 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.35 ms | 1.20 ms | 2.74 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.33 ms | 0.05 ms | 0.09 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
