# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-26T00:41:13.901Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 793.75 MB, peak 857.61 MB (Δ 63.86 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 5.45 ms | 1.39 ms | 2.51 ms | 1.30 ms | 1.14 ms | 2.8 KB | 747 | 10 |
| `Roman Empire` | multi | 4.95 ms | 3.44 ms | 4.18 ms | 2.07 ms | 1.95 ms | 2.7 KB | 751 | 10 |
| `the capital of` | phrase | 26.35 ms | 17.13 ms | 19.27 ms | 17.77 ms | 14.60 ms | 2.7 KB | 754 | 10 |
| `phlogiston` | rare | 2.58 ms | 1.25 ms | 1.30 ms | 0.88 ms | 0.85 ms | 2.7 KB | 742 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 0.34 ms | 0.07 ms | 0.10 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.01 ms | 0.90 ms | 0.96 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.32 ms | 0.04 ms | 0.07 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
