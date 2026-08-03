# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-08-03T01:29:19.068Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.84 MB, peak 151.16 MB (Δ 320.0 KB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 4118.03 ms | 2683.99 ms | 2784.67 ms | — | — | 8.5 KB | 2,381 | 50 |
| `Roman Empire` | multi | 2697.14 ms | 2710.68 ms | 2834.98 ms | — | — | 7.7 KB | 2,326 | 50 |
| `the capital of` | phrase | 2731.02 ms | 2757.02 ms | 2967.25 ms | — | — | 7.9 KB | 2,427 | 50 |
| `phlogiston` | rare | 2744.00 ms | 2705.67 ms | 2863.21 ms | — | — | 4.8 KB | 1,410 | 30 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 8.62 ms | 0.57 ms | 1.04 ms | 4.4 KB |
| large | `Encyclopedia/I/Italy.md` | 17.28 ms | 15.90 ms | 20.30 ms | 1.55 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 36.81 ms | 33.04 ms | 35.28 ms | 13.8 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
