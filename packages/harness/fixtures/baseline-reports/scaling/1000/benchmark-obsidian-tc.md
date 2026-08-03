# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-08-03T01:23:48.744Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 159.09 MB, peak 213.42 MB (Δ 54.33 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 329.82 ms | 267.81 ms | 274.00 ms | — | — | 8.1 KB | 2,364 | 50 |
| `Roman Empire` | multi | 268.16 ms | 270.77 ms | 276.11 ms | — | — | 4.4 KB | 1,286 | 27 |
| `the capital of` | phrase | 260.09 ms | 252.31 ms | 272.76 ms | — | — | 6.1 KB | 1,881 | 38 |
| `phlogiston` | rare | 247.57 ms | 265.39 ms | 274.00 ms | — | — | 56 B | 17 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 7.82 ms | 0.57 ms | 0.86 ms | 4.2 KB |
| large | `Encyclopedia/E/English Law.md` | 8.13 ms | 8.50 ms | 14.82 ms | 791.8 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 6.37 ms | 4.04 ms | 8.10 ms | 14.7 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
