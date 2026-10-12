# Benchmark — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-10-12T20:10:15.333Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 156.95 MB, peak 209.84 MB (Δ 52.89 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 204.03 ms | 17.49 ms | 18.14 ms | — | — | 7.3 KB | 2,008 | 20 |
| `Roman Empire` | multi | 19.37 ms | 18.11 ms | 19.57 ms | — | — | 7.3 KB | 2,083 | 20 |
| `the capital of` | phrase | 25.25 ms | 25.73 ms | 26.59 ms | — | — | 7.5 KB | 2,287 | 20 |
| `phlogiston` | rare | 13.37 ms | 13.43 ms | 14.27 ms | — | — | 1003 B | 273 | 3 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.44 ms | 0.11 ms | 0.17 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 13.77 ms | 12.79 ms | 13.93 ms | 788.0 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.29 ms | 0.05 ms | 0.07 ms | 100 B |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
