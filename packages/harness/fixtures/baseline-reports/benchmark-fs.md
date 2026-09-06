# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-09-05T14:52:01.209Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 710.55 MB, peak 805.95 MB (Δ 95.41 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4.64 ms | 1.39 ms | 2.58 ms | 1.42 ms | 1.13 ms | 2.8 KB | 753 | 10 |
| `Roman Empire` | multi | 4.88 ms | 3.43 ms | 4.10 ms | 1.93 ms | 1.88 ms | 2.7 KB | 755 | 10 |
| `the capital of` | phrase | 25.41 ms | 17.89 ms | 20.27 ms | 14.78 ms | 15.91 ms | 2.7 KB | 765 | 10 |
| `phlogiston` | rare | 2.51 ms | 1.25 ms | 1.33 ms | 0.87 ms | 0.84 ms | 2.7 KB | 750 | 10 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.90 ms | 0.07 ms | 0.09 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 1.04 ms | 0.96 ms | 1.03 ms | 786.3 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.33 ms | 0.04 ms | 0.06 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
