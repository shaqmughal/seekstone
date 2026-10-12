# Benchmark — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-10-12T15:22:45.975Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 499.73 MB, peak 574.59 MB (Δ 74.86 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 3.07 ms | 0.85 ms | 1.41 ms | 0.69 ms | 0.56 ms | 2.7 KB | 758 | 10 |
| `Roman Empire` | multi | 3.01 ms | 2.08 ms | 2.70 ms | 0.95 ms | 0.91 ms | 2.7 KB | 770 | 10 |
| `the capital of` | phrase | 12.70 ms | 8.06 ms | 9.34 ms | 6.64 ms | 6.64 ms | 2.7 KB | 773 | 10 |
| `phlogiston` | rare | 1.59 ms | 0.82 ms | 1.17 ms | 0.80 ms | 0.73 ms | 1.1 KB | 308 | 4 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.34 ms | 0.07 ms | 0.09 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 0.82 ms | 0.73 ms | 0.78 ms | 783.9 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.27 ms | 0.04 ms | 0.06 ms | 512 B |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
