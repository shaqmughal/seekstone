# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-27T01:50:03.766Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 338.77 MB, peak 366.63 MB (Δ 27.86 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.15 ms | 0.56 ms | 0.67 ms | 0.55 ms | 0.47 ms | 2.2 KB | 609 | 10 |
| `Roman Empire` | multi | 1.34 ms | 0.89 ms | 1.01 ms | 0.89 ms | 0.85 ms | 2.2 KB | 649 | 10 |
| `the capital of` | phrase | 3.92 ms | 2.49 ms | 2.79 ms | 2.43 ms | 2.46 ms | 2.0 KB | 589 | 10 |
| `phlogiston` | rare | 0.77 ms | 0.32 ms | 0.34 ms | 0.34 ms | 0.31 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.77 ms | 0.27 ms | 0.38 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.55 ms | 0.34 ms | 1.95 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.56 ms | 0.15 ms | 0.28 ms | 25.9 KB |
| `list_tags` | all tags | 0.60 ms | 0.23 ms | 0.40 ms | 8.5 KB |
| `outline_note` | `Encyclopedia/B/Bauernfeld.md` | 0.72 ms | 0.22 ms | 0.29 ms | 181 B |
| `get_backlinks` | `Encyclopedia/B/Bauernfeld.md` | 0.15 ms | 0.02 ms | 0.04 ms | 158 B |
| `get_links` | `Encyclopedia/B/Bauernfeld.md` | 0.18 ms | 0.01 ms | 0.02 ms | 50 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
