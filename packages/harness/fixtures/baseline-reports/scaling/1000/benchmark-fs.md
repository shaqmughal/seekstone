# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-09-07T02:57:45.798Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 287.70 MB, peak 347.94 MB (Δ 60.23 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 2.33 ms | 0.79 ms | 0.85 ms | 0.48 ms | 0.40 ms | 2.7 KB | 756 | 10 |
| `Roman Empire` | multi | 1.52 ms | 1.04 ms | 1.42 ms | 0.29 ms | 0.27 ms | 2.8 KB | 788 | 10 |
| `the capital of` | phrase | 3.84 ms | 2.38 ms | 2.73 ms | 1.62 ms | 1.58 ms | 2.7 KB | 791 | 10 |
| `phlogiston` | rare | 0.60 ms | 0.28 ms | 0.31 ms | 0.30 ms | 0.27 ms | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 8.31 ms | 0.08 ms | 0.15 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 0.41 ms | 0.30 ms | 0.34 ms | 389.5 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.23 ms | 0.04 ms | 0.05 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
