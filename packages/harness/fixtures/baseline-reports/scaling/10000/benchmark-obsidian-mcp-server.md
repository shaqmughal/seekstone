# Benchmark — obsidian-mcp-server

- **Adapter:** obsidian-mcp-server (cyanheads, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T02:37:46.945Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.75 MB, peak 179.03 MB (Δ 28.28 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 175.80 ms | 138.11 ms | 158.28 ms | — | — | 14.1 KB | 4,521 | 0 |
| `Roman Empire` | multi | 185.37 ms | 183.47 ms | 192.75 ms | — | — | 34.6 KB | 9,716 | 0 |
| `the capital of` | phrase | 2646.42 ms | 2515.37 ms | 2552.49 ms | — | — | 130.1 KB | 42,373 | 0 |
| `phlogiston` | rare | 117.06 ms | 90.39 ms | 91.46 ms | — | — | 7.6 KB | 1,962 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 6.16 ms | 2.98 ms | 3.98 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 16.98 ms | 10.92 ms | 17.73 ms | 781.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 10.05 ms | 3.88 ms | 6.43 ms | 780 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
