# Benchmark — obsidian-mcp

- **Adapter:** obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-10-12T22:59:47.123Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 159.63 MB, peak 188.19 MB (Δ 28.56 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 98.67 ms | 80.28 ms | 85.42 ms | — | — | 65.8 KB | 18,066 | 0 |
| `Roman Empire` | multi | 76.96 ms | 78.76 ms | 83.33 ms | — | — | 2.7 KB | 757 | 0 |
| `the capital of` | phrase | 78.78 ms | 80.20 ms | 89.15 ms | — | — | 4.1 KB | 1,201 | 0 |
| `phlogiston` | rare | 75.96 ms | 72.96 ms | 74.27 ms | — | — | 17 B | 4 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.59 ms | 0.18 ms | 0.23 ms | 2.0 KB |
| large | `Encyclopedia/E/English Law.md` | 1.24 ms | 1.20 ms | 1.32 ms | 389.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.29 ms | 0.08 ms | 1.30 ms | 30 B |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
