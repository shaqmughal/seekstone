# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-26T01:54:51.041Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 285.47 MB, peak 343.09 MB (Δ 57.63 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.30 ms | 0.87 ms | 1.21 ms | 0.65 ms | 0.43 ms | 2.7 KB | 757 | 10 |
| `Roman Empire` | multi | 1.75 ms | 1.36 ms | 1.84 ms | 0.44 ms | 0.35 ms | 2.8 KB | 788 | 10 |
| `the capital of` | phrase | 4.28 ms | 2.83 ms | 3.23 ms | 1.88 ms | 1.73 ms | 2.7 KB | 786 | 10 |
| `phlogiston` | rare | 0.82 ms | 0.31 ms | 0.36 ms | 0.31 ms | 0.30 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.60 ms | 0.21 ms | 0.31 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.59 ms | 0.49 ms | 0.57 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 1.32 ms | 0.05 ms | 0.08 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
