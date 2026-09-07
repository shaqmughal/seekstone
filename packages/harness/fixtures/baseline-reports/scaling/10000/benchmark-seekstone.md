# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-09-07T03:37:37.557Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 842.09 MB, peak 950.94 MB (Δ 108.84 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4.54 ms | 1.33 ms | 1.72 ms | 1.38 ms | 1.21 ms | 1.8 KB | 507 | 10 |
| `Roman Empire` | multi | 4.47 ms | 2.98 ms | 3.94 ms | 2.97 ms | 2.89 ms | 2.1 KB | 602 | 10 |
| `the capital of` | phrase | 23.49 ms | 15.39 ms | 17.85 ms | 16.94 ms | 15.79 ms | 1.9 KB | 565 | 10 |
| `phlogiston` | rare | 2.57 ms | 1.04 ms | 1.07 ms | 0.99 ms | 0.98 ms | 2.3 KB | 637 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.65 ms | 0.19 ms | 0.34 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 1.71 ms | 1.55 ms | 1.60 ms | 786.3 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.59 ms | 0.20 ms | 8.19 ms | 26.2 KB |
| `list_tags` | all tags | 2.92 ms | 1.73 ms | 2.17 ms | 11.2 KB |
| `context_pack` | `church` | 54.09 ms | 51.44 ms | 53.36 ms | 2.0 KB |
| `outline_note` | `Encyclopedia/A/Anglesite.md` | 0.89 ms | 0.19 ms | 0.32 ms | 180 B |
| `get_backlinks` | `Encyclopedia/A/Anglesite.md` | 0.11 ms | 0.01 ms | 0.02 ms | 579 B |
| `get_links` | `Encyclopedia/A/Anglesite.md` | 6.25 ms | 4.81 ms | 12.66 ms | 902 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
