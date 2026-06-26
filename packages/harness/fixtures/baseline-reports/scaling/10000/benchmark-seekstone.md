# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-26T01:56:20.846Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 809.09 MB, peak 841.72 MB (Δ 32.63 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 5.14 ms | 1.71 ms | 2.67 ms | 2.17 ms | 1.39 ms | 2.7 KB | 741 | 10 |
| `Roman Empire` | multi | 5.65 ms | 4.48 ms | 5.99 ms | 3.87 ms | 4.44 ms | 3.1 KB | 857 | 10 |
| `the capital of` | phrase | 30.82 ms | 22.50 ms | 25.45 ms | 25.05 ms | 24.85 ms | 2.7 KB | 759 | 10 |
| `phlogiston` | rare | 2.19 ms | 1.17 ms | 3.78 ms | 1.38 ms | 1.15 ms | 3.4 KB | 926 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 0.58 ms | 0.08 ms | 0.15 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.09 ms | 1.08 ms | 1.16 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.55 ms | 0.15 ms | 0.27 ms | 26.2 KB |
| `list_tags` | all tags | 3.08 ms | 2.16 ms | 2.61 ms | 11.2 KB |
| `outline_note` | `Encyclopedia/A/Anglesite.md` | 3.42 ms | 0.21 ms | 0.32 ms | 180 B |
| `get_backlinks` | `Encyclopedia/A/Anglesite.md` | 0.10 ms | 0.01 ms | 0.01 ms | 65 B |
| `get_links` | `Encyclopedia/A/Anglesite.md` | 0.10 ms | 0.01 ms | 0.02 ms | 49 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
