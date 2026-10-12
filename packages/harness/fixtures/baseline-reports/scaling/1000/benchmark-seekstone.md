# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-10-12T15:22:16.116Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 354.52 MB, peak 521.72 MB (Δ 167.20 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1.90 ms | 0.54 ms | 0.63 ms | 0.52 ms | 0.45 ms | 2.2 KB | 609 | 10 |
| `Roman Empire` | multi | 1.21 ms | 0.86 ms | 0.92 ms | 0.90 ms | 0.84 ms | 2.2 KB | 649 | 10 |
| `the capital of` | phrase | 3.73 ms | 2.35 ms | 2.70 ms | 2.27 ms | 2.27 ms | 2.0 KB | 591 | 10 |
| `phlogiston` | rare | 0.65 ms | 0.31 ms | 0.33 ms | 0.30 ms | 0.30 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.64 ms | 0.18 ms | 0.23 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.65 ms | 0.40 ms | 1.71 ms | 389.5 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.49 ms | 0.13 ms | 0.25 ms | 25.9 KB |
| `list_tags` | all tags | 0.58 ms | 0.22 ms | 0.37 ms | 8.5 KB |
| `list_tasks` | open tasks, vault-wide | 0.32 ms | 0.05 ms | 0.14 ms | 10.2 KB |
| `context_pack` | `church` | 26.17 ms | 20.95 ms | 23.15 ms | 2.0 KB |
| `outline_note` | `Encyclopedia/B/Bauernfeld.md` | 0.48 ms | 0.08 ms | 0.13 ms | 181 B |
| `get_backlinks` | `Encyclopedia/B/Bauernfeld.md` | 0.08 ms | 0.01 ms | 0.02 ms | 158 B |
| `get_links` | `Encyclopedia/B/Bauernfeld.md` | 0.05 ms | 0.01 ms | 0.02 ms | 50 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
