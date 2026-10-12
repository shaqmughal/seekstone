# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-10-12T15:22:41.562Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 294.39 MB, peak 365.16 MB (Δ 70.77 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.20 ms | 0.74 ms | 1.19 ms | 0.51 ms | 0.42 ms | 2.7 KB | 753 | 10 |
| `Roman Empire` | multi | 1.71 ms | 1.20 ms | 1.34 ms | 0.35 ms | 0.32 ms | 2.8 KB | 788 | 10 |
| `the capital of` | phrase | 3.86 ms | 2.59 ms | 2.72 ms | 1.72 ms | 1.69 ms | 2.7 KB | 792 | 10 |
| `phlogiston` | rare | 0.81 ms | 0.31 ms | 0.34 ms | 0.31 ms | 0.30 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.32 ms | 0.07 ms | 0.11 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.29 ms | 0.20 ms | 0.22 ms | 389.5 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.20 ms | 0.04 ms | 0.05 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
