# Benchmark — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:52:52.962Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.22 MB, peak 166.14 MB (Δ 15.92 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 334.76 ms | 216.28 ms | 231.73 ms | — | — | 303.6 KB | 73,137 | 0 |
| `Roman Empire` | multi | 230.41 ms | 213.62 ms | 214.48 ms | — | — | 14.2 KB | 3,445 | 0 |
| `the capital of` | phrase | 223.17 ms | 223.98 ms | 226.16 ms | — | — | 13.6 KB | 3,331 | 0 |
| `phlogiston` | rare | 199.91 ms | 199.65 ms | 200.87 ms | — | — | 5.9 KB | 1,438 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.68 ms | 0.36 ms | 0.53 ms | 2.2 KB |
| large | `Encyclopedia/I/Italy.md` | 9.52 ms | 7.62 ms | 7.82 ms | 781.9 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 6.69 ms | 6.34 ms | 6.88 ms | 12.2 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
