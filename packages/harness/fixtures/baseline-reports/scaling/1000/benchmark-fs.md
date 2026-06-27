# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-06-27T01:50:01.815Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 288.83 MB, peak 345.88 MB (Δ 57.05 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.45 ms | 0.83 ms | 0.93 ms | 0.58 ms | 0.43 ms | 2.7 KB | 755 | 10 |
| `Roman Empire` | multi | 1.71 ms | 1.13 ms | 1.39 ms | 0.31 ms | 0.29 ms | 2.8 KB | 788 | 10 |
| `the capital of` | phrase | 4.30 ms | 2.71 ms | 3.05 ms | 1.76 ms | 1.79 ms | 2.7 KB | 786 | 10 |
| `phlogiston` | rare | 0.81 ms | 0.31 ms | 0.36 ms | 0.33 ms | 0.30 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 13.81 ms | 0.09 ms | 0.29 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.38 ms | 0.31 ms | 0.37 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.30 ms | 0.04 ms | 0.06 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
