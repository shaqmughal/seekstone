# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-10-12T15:22:39.907Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 848.41 MB, peak 1994.20 MB (Δ 1145.80 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4.98 ms | 1.32 ms | 2.05 ms | 1.55 ms | 1.21 ms | 1.8 KB | 507 | 10 |
| `Roman Empire` | multi | 4.59 ms | 3.29 ms | 4.02 ms | 3.09 ms | 2.98 ms | 2.1 KB | 602 | 10 |
| `the capital of` | phrase | 25.03 ms | 16.75 ms | 18.96 ms | 19.49 ms | 16.33 ms | 1.9 KB | 565 | 10 |
| `phlogiston` | rare | 2.22 ms | 1.06 ms | 1.11 ms | 1.09 ms | 1.06 ms | 2.3 KB | 637 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 2.64 ms | 0.08 ms | 0.13 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 1.15 ms | 1.00 ms | 1.08 ms | 786.3 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.46 ms | 0.12 ms | 0.23 ms | 26.2 KB |
| `list_tags` | all tags | 2.57 ms | 1.59 ms | 3.32 ms | 11.2 KB |
| `list_tasks` | open tasks, vault-wide | 1.26 ms | 0.32 ms | 1.03 ms | 10.6 KB |
| `context_pack` | `church` | 172.82 ms | 169.60 ms | 200.77 ms | 2.0 KB |
| `outline_note` | `Encyclopedia/A/Anglesite.md` | 0.52 ms | 0.08 ms | 0.14 ms | 180 B |
| `get_backlinks` | `Encyclopedia/A/Anglesite.md` | 0.09 ms | 0.01 ms | 0.02 ms | 579 B |
| `get_links` | `Encyclopedia/A/Anglesite.md` | 23.51 ms | 23.42 ms | 25.94 ms | 902 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
