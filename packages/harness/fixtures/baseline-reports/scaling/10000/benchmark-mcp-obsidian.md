# Benchmark — mcp-obsidian

- **Adapter:** mcp-obsidian (MarkusPfundstein, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T02:36:45.598Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 149.42 MB, peak 3801.69 MB (Δ 3652.27 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 220.46 ms | 173.47 ms | 194.81 ms | — | — | 4.67 MB | 1,260,114 | 2226 |
| `Roman Empire` | multi | 247.20 ms | 207.74 ms | 219.09 ms | — | — | 2.62 MB | 703,210 | 453 |
| `the capital of` | phrase | 5985.95 ms | 5720.18 ms | 6070.48 ms | — | — | 370.90 MB | 97,808,241 | 1105 |
| `phlogiston` | rare | 325.39 ms | 100.03 ms | 105.72 ms | — | — | 17.4 KB | 4,365 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 11.85 ms | 7.39 ms | 9.79 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 12.03 ms | 12.05 ms | 14.64 ms | 796.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 14.13 ms | 8.75 ms | 12.78 ms | 184 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
