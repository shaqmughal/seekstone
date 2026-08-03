# Benchmark — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-08-03T01:32:43.911Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.98 MB, peak 201.77 MB (Δ 48.78 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 103.37 ms | 17.56 ms | 18.53 ms | — | — | 7.3 KB | 2,000 | 20 |
| `Roman Empire` | multi | 19.23 ms | 19.32 ms | 22.99 ms | — | — | 7.3 KB | 2,058 | 20 |
| `the capital of` | phrase | 27.60 ms | 27.13 ms | 29.05 ms | — | — | 7.5 KB | 2,273 | 20 |
| `phlogiston` | rare | 13.60 ms | 13.43 ms | 14.87 ms | — | — | 1004 B | 273 | 3 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.54 ms | 0.12 ms | 0.18 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 14.58 ms | 13.86 ms | 15.92 ms | 785.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.43 ms | 0.07 ms | 0.10 ms | 100 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
