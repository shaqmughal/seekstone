# Benchmark — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-09-07T03:39:03.903Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.28 MB, peak 195.19 MB (Δ 42.91 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 308.11 ms | 32.20 ms | 33.20 ms | — | — | 7.1 KB | 1,962 | 20 |
| `Roman Empire` | multi | 35.87 ms | 34.63 ms | 36.47 ms | — | — | 7.5 KB | 2,178 | 20 |
| `the capital of` | phrase | 53.94 ms | 49.36 ms | 52.99 ms | — | — | 7.5 KB | 2,260 | 20 |
| `phlogiston` | rare | 24.48 ms | 24.68 ms | 25.21 ms | — | — | 2.7 KB | 762 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 0.47 ms | 0.12 ms | 0.16 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 14.47 ms | 13.38 ms | 15.58 ms | 790.4 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.24 ms | 0.06 ms | 0.08 ms | 94 B |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
