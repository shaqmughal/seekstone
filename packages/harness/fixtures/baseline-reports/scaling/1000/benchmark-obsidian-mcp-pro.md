# Benchmark — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-10-12T21:01:06.489Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 156.42 MB, peak 194.17 MB (Δ 37.75 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 73.44 ms | 42.29 ms | 44.68 ms | — | — | 84.5 KB | 20,373 | 0 |
| `Roman Empire` | multi | 42.28 ms | 40.68 ms | 41.53 ms | — | — | 8.4 KB | 2,041 | 0 |
| `the capital of` | phrase | 41.90 ms | 42.55 ms | 43.12 ms | — | — | 7.2 KB | 1,777 | 0 |
| `phlogiston` | rare | 38.26 ms | 38.34 ms | 38.90 ms | — | — | 33 B | 9 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.34 ms | 0.38 ms | 0.44 ms | 2.1 KB |
| large | `Encyclopedia/E/English Law.md` | 5.26 ms | 3.16 ms | 3.65 ms | 389.8 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 3.33 ms | 2.06 ms | 2.72 ms | 13.2 KB |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
