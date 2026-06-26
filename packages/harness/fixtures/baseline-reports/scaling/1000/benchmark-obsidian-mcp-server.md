# Benchmark — obsidian-mcp-server

- **Adapter:** obsidian-mcp-server (cyanheads, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T03:26:13.872Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 151.20 MB, peak 183.66 MB (Δ 32.45 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 54.93 ms | 15.94 ms | 19.10 ms | — | — | 14.4 KB | 4,118 | 0 |
| `Roman Empire` | multi | 23.09 ms | 22.93 ms | 24.12 ms | — | — | 74.3 KB | 20,121 | 0 |
| `the capital of` | phrase | 291.65 ms | 276.68 ms | 286.70 ms | — | — | 132.4 KB | 41,358 | 0 |
| `phlogiston` | rare | 15.90 ms | 11.83 ms | 14.02 ms | — | — | 48 B | 16 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 6.65 ms | 3.04 ms | 3.83 ms | 2.0 KB |
| large | `Encyclopedia/E/English Law.md` | 12.23 ms | 7.46 ms | 10.03 ms | 389.1 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 5.79 ms | 2.56 ms | 3.13 ms | 780 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
