# Benchmark — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-09-07T02:57:44.518Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 342.94 MB, peak 371.77 MB (Δ 28.83 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1.98 ms | 0.51 ms | 0.60 ms | 0.51 ms | 0.45 ms | 2.2 KB | 609 | 10 |
| `Roman Empire` | multi | 1.25 ms | 0.84 ms | 1.07 ms | 0.81 ms | 0.79 ms | 2.2 KB | 649 | 10 |
| `the capital of` | phrase | 3.56 ms | 2.18 ms | 2.52 ms | 2.21 ms | 2.22 ms | 2.0 KB | 591 | 10 |
| `phlogiston` | rare | 0.64 ms | 0.28 ms | 0.32 ms | 0.28 ms | 0.27 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.57 ms | 0.17 ms | 0.29 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.69 ms | 0.51 ms | 1.66 ms | 389.5 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.45 ms | 0.12 ms | 0.25 ms | 25.9 KB |
| `list_tags` | all tags | 0.53 ms | 0.21 ms | 0.37 ms | 8.5 KB |
| `context_pack` | `church` | 9.19 ms | 8.39 ms | 8.67 ms | 2.0 KB |
| `outline_note` | `Encyclopedia/B/Bauernfeld.md` | 0.59 ms | 0.19 ms | 0.23 ms | 181 B |
| `get_backlinks` | `Encyclopedia/B/Bauernfeld.md` | 0.11 ms | 0.02 ms | 0.03 ms | 158 B |
| `get_links` | `Encyclopedia/B/Bauernfeld.md` | 0.07 ms | 0.01 ms | 0.02 ms | 50 B |

> **Not supported by this backend:** `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
