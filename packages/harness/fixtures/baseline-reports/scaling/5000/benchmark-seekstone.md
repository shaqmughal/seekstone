# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-09-07T03:09:11.950Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 532.63 MB, peak 568.44 MB (Δ 35.81 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.14 ms | 0.76 ms | 1.06 ms | 0.76 ms | 0.64 ms | 2.1 KB | 569 | 10 |
| `Roman Empire` | multi | 2.84 ms | 1.93 ms | 2.46 ms | 1.83 ms | 1.92 ms | 2.2 KB | 627 | 10 |
| `the capital of` | phrase | 14.07 ms | 7.46 ms | 9.73 ms | 9.01 ms | 7.43 ms | 2.0 KB | 579 | 10 |
| `phlogiston` | rare | 1.62 ms | 0.69 ms | 0.76 ms | 0.73 ms | 0.68 ms | 853 B | 249 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 2.14 ms | 0.21 ms | 0.38 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 1.65 ms | 1.50 ms | 7.06 ms | 783.9 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.55 ms | 0.38 ms | 0.40 ms | 26.8 KB |
| `list_tags` | all tags | 2.63 ms | 1.26 ms | 2.31 ms | 11.0 KB |
| `context_pack` | `church` | 15.99 ms | 6.78 ms | 7.59 ms | 2.0 KB |
| `outline_note` | `Encyclopedia/H/Hoole.md` | 0.51 ms | 0.08 ms | 0.15 ms | 234 B |
| `get_backlinks` | `Encyclopedia/H/Hoole.md` | 0.18 ms | 0.09 ms | 0.12 ms | 365 B |
| `get_links` | `Encyclopedia/H/Hoole.md` | 4.46 ms | 4.34 ms | 4.46 ms | 865 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
