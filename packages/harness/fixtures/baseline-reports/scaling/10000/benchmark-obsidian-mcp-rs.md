# Benchmark — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-08-03T01:32:48.628Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.00 MB, peak 201.14 MB (Δ 49.14 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 204.78 ms | 34.41 ms | 36.08 ms | — | — | 7.1 KB | 1,949 | 20 |
| `Roman Empire` | multi | 38.48 ms | 35.60 ms | 37.83 ms | — | — | 7.4 KB | 2,135 | 20 |
| `the capital of` | phrase | 51.61 ms | 51.75 ms | 54.66 ms | — | — | 7.4 KB | 2,210 | 20 |
| `phlogiston` | rare | 25.09 ms | 24.95 ms | 25.81 ms | — | — | 2.7 KB | 762 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 0.64 ms | 0.13 ms | 0.21 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 15.78 ms | 13.95 ms | 17.90 ms | 785.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.41 ms | 0.07 ms | 0.13 ms | 94 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
