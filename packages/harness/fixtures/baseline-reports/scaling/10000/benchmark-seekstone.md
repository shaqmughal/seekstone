# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-27T01:51:18.663Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 804.64 MB, peak 894.28 MB (Δ 89.64 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4.85 ms | 1.53 ms | 2.30 ms | 1.71 ms | 1.29 ms | 1.8 KB | 507 | 10 |
| `Roman Empire` | multi | 5.56 ms | 3.35 ms | 4.48 ms | 3.57 ms | 3.21 ms | 2.1 KB | 597 | 10 |
| `the capital of` | phrase | 25.78 ms | 18.67 ms | 21.84 ms | 18.71 ms | 18.63 ms | 1.9 KB | 567 | 10 |
| `phlogiston` | rare | 2.77 ms | 1.17 ms | 1.81 ms | 1.14 ms | 1.07 ms | 2.3 KB | 634 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.43 ms | 0.07 ms | 0.15 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.78 ms | 0.97 ms | 1.08 ms | 781.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.51 ms | 0.15 ms | 0.29 ms | 26.2 KB |
| `list_tags` | all tags | 2.58 ms | 1.76 ms | 2.84 ms | 11.2 KB |
| `outline_note` | `Encyclopedia/A/Anglesite.md` | 0.50 ms | 0.08 ms | 0.11 ms | 180 B |
| `get_backlinks` | `Encyclopedia/A/Anglesite.md` | 0.10 ms | 0.00 ms | 0.01 ms | 65 B |
| `get_links` | `Encyclopedia/A/Anglesite.md` | 0.11 ms | 0.01 ms | 0.02 ms | 49 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
