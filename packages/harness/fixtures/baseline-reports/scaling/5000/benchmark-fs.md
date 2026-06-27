# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-27T01:50:08.601Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 513.67 MB, peak 687.11 MB (Δ 173.44 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.34 ms | 0.87 ms | 1.21 ms | 0.81 ms | 0.58 ms | 2.7 KB | 758 | 10 |
| `Roman Empire` | multi | 4.41 ms | 2.51 ms | 4.33 ms | 1.24 ms | 1.05 ms | 2.7 KB | 769 | 10 |
| `the capital of` | phrase | 18.75 ms | 9.83 ms | 15.30 ms | 15.12 ms | 8.43 ms | 2.8 KB | 771 | 10 |
| `phlogiston` | rare | 1.74 ms | 0.80 ms | 0.89 ms | 0.81 ms | 0.73 ms | 1.1 KB | 301 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 5.42 ms | 0.07 ms | 0.16 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.02 ms | 0.94 ms | 1.12 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.34 ms | 0.04 ms | 0.08 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
