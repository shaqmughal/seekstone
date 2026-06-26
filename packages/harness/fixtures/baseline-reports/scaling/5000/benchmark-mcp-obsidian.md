# Benchmark — mcp-obsidian

- **Adapter:** mcp-obsidian (MarkusPfundstein, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T03:13:17.585Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 151.64 MB, peak 2198.08 MB (Δ 2046.44 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 126.17 ms | 91.13 ms | 101.71 ms | — | — | 2.45 MB | 658,490 | 1091 |
| `Roman Empire` | multi | 125.23 ms | 105.19 ms | 109.35 ms | — | — | 1.31 MB | 350,537 | 223 |
| `the capital of` | phrase | 2794.45 ms | 2704.82 ms | 2761.97 ms | — | — | 176.75 MB | 46,564,482 | 551 |
| `phlogiston` | rare | 102.12 ms | 58.92 ms | 67.81 ms | — | — | 9.3 KB | 2,336 | 3 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 15.07 ms | 8.45 ms | 10.34 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 11.87 ms | 13.28 ms | 15.55 ms | 796.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 10.17 ms | 8.02 ms | 20.62 ms | 245 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
