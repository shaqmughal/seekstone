# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-27T01:50:32.126Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 698.17 MB, peak 805.17 MB (Δ 107.00 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4.52 ms | 1.45 ms | 2.49 ms | 1.68 ms | 1.12 ms | 2.8 KB | 747 | 10 |
| `Roman Empire` | multi | 5.07 ms | 3.66 ms | 4.97 ms | 2.21 ms | 1.87 ms | 2.7 KB | 751 | 10 |
| `the capital of` | phrase | 27.06 ms | 19.49 ms | 21.49 ms | 19.14 ms | 18.48 ms | 2.7 KB | 754 | 10 |
| `phlogiston` | rare | 3.14 ms | 1.54 ms | 2.48 ms | 0.89 ms | 0.99 ms | 2.7 KB | 742 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.20 ms | 0.07 ms | 0.13 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.72 ms | 1.02 ms | 1.21 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.42 ms | 0.05 ms | 0.10 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
