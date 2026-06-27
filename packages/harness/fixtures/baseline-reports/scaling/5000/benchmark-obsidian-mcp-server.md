# Benchmark — obsidian-mcp-server

- **Adapter:** obsidian-mcp-server (cyanheads, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T03:13:48.416Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.19 MB, peak 181.47 MB (Δ 29.28 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 118.19 ms | 68.91 ms | 75.46 ms | — | — | 14.3 KB | 4,445 | 0 |
| `Roman Empire` | multi | 88.45 ms | 92.12 ms | 95.13 ms | — | — | 38.6 KB | 10,935 | 0 |
| `the capital of` | phrase | 1285.03 ms | 1216.32 ms | 1268.33 ms | — | — | 131.9 KB | 42,185 | 0 |
| `phlogiston` | rare | 69.12 ms | 45.75 ms | 47.02 ms | — | — | 3.8 KB | 975 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 6.42 ms | 3.22 ms | 4.14 ms | 2.0 KB |
| large | `Encyclopedia/I/Italy.md` | 21.14 ms | 11.09 ms | 17.04 ms | 781.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 7.61 ms | 3.89 ms | 4.84 ms | 856 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
