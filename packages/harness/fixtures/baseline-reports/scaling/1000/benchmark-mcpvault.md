# Benchmark — mcpvault

- **Adapter:** mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)
- **Snapshot:** 2026-09-07T02:57:55.652Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.83 MB, peak 171.31 MB (Δ 18.48 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 93.42 ms | 81.19 ms | 82.95 ms | — | — | 2.4 KB | 767 | 10 |
| `Roman Empire` | multi | 100.98 ms | 100.11 ms | 100.82 ms | — | — | 2.3 KB | 744 | 10 |
| `the capital of` | phrase | 104.28 ms | 99.37 ms | 106.62 ms | — | — | 2.2 KB | 742 | 10 |
| `phlogiston` | rare | 75.43 ms | 75.15 ms | 75.76 ms | — | — | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.30 ms | 0.26 ms | 0.32 ms | 2.0 KB |
| large | `Encyclopedia/E/English Law.md` | 4.68 ms | 2.03 ms | 2.45 ms | 396.2 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.60 ms | 0.27 ms | 1.48 ms | 165 B |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
