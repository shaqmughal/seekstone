# Benchmark — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-08-03T01:32:40.637Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 161.25 MB, peak 194.03 MB (Δ 32.78 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 34.09 ms | 6.33 ms | 6.91 ms | — | — | 7.3 KB | 2,048 | 20 |
| `Roman Empire` | multi | 6.59 ms | 6.52 ms | 7.21 ms | — | — | 6.9 KB | 1,964 | 20 |
| `the capital of` | phrase | 8.84 ms | 7.70 ms | 8.64 ms | — | — | 7.4 KB | 2,238 | 20 |
| `phlogiston` | rare | 4.33 ms | 3.88 ms | 4.17 ms | — | — | 53 B | 17 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.42 ms | 0.11 ms | 0.15 ms | 1.9 KB |
| large | `Encyclopedia/E/English Law.md` | 4.75 ms | 4.47 ms | 4.73 ms | 391.0 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.27 ms | 0.07 ms | 0.12 ms | 100 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
