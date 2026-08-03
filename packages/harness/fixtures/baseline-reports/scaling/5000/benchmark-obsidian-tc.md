# Benchmark — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-08-03T01:25:36.620Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.31 MB, peak 243.56 MB (Δ 93.25 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 1854.12 ms | 1281.15 ms | 1404.78 ms | — | — | 8.3 KB | 2,364 | 50 |
| `Roman Empire` | multi | 1355.73 ms | 1316.92 ms | 1357.28 ms | — | — | 8.1 KB | 2,445 | 50 |
| `the capital of` | phrase | 1288.86 ms | 1314.29 ms | 1357.32 ms | — | — | 8.0 KB | 2,486 | 50 |
| `phlogiston` | rare | 1317.80 ms | 1294.30 ms | 1357.33 ms | — | — | 2.7 KB | 784 | 17 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.88 ms | 0.54 ms | 3.31 ms | 4.3 KB |
| large | `Encyclopedia/I/Italy.md` | 16.27 ms | 15.08 ms | 16.47 ms | 1.55 MB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 18.80 ms | 13.84 ms | 17.27 ms | 14.1 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
