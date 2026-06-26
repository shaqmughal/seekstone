# Benchmark — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:53:12.858Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 151.70 MB, peak 170.48 MB (Δ 18.78 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 655.26 ms | 425.49 ms | 442.68 ms | — | — | 400.6 KB | 96,442 | 0 |
| `Roman Empire` | multi | 429.81 ms | 435.19 ms | 436.36 ms | — | — | 29.7 KB | 7,252 | 0 |
| `the capital of` | phrase | 455.07 ms | 458.07 ms | 462.18 ms | — | — | 15.4 KB | 3,785 | 0 |
| `phlogiston` | rare | 408.24 ms | 402.07 ms | 404.58 ms | — | — | 11.5 KB | 2,786 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.42 ms | 0.41 ms | 0.47 ms | 2.2 KB |
| large | `Encyclopedia/I/Italy.md` | 9.54 ms | 7.87 ms | 8.14 ms | 781.9 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 12.84 ms | 12.02 ms | 12.06 ms | 11.5 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
