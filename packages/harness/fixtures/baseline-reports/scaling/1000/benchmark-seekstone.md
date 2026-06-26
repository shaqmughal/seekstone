# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-06-26T01:54:49.643Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 350.98 MB, peak 366.28 MB (Δ 15.30 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.13 ms | 0.58 ms | 0.95 ms | 0.65 ms | 0.48 ms | 3.3 KB | 903 | 10 |
| `Roman Empire` | multi | 1.34 ms | 0.98 ms | 2.12 ms | 1.20 ms | 0.95 ms | 3.3 KB | 935 | 10 |
| `the capital of` | phrase | 4.13 ms | 2.65 ms | 3.05 ms | 2.53 ms | 2.55 ms | 2.9 KB | 821 | 10 |
| `phlogiston` | rare | 0.79 ms | 0.32 ms | 0.38 ms | 0.33 ms | 0.29 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 10.08 ms | 0.08 ms | 0.17 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.58 ms | 0.34 ms | 0.53 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.60 ms | 0.18 ms | 0.30 ms | 25.9 KB |
| `list_tags` | all tags | 0.61 ms | 0.24 ms | 0.41 ms | 8.5 KB |
| `outline_note` | `Encyclopedia/B/Bauernfeld.md` | 0.54 ms | 0.09 ms | 0.12 ms | 181 B |
| `get_backlinks` | `Encyclopedia/B/Bauernfeld.md` | 0.11 ms | 0.02 ms | 0.02 ms | 158 B |
| `get_links` | `Encyclopedia/B/Bauernfeld.md` | 0.07 ms | 0.01 ms | 0.02 ms | 50 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
