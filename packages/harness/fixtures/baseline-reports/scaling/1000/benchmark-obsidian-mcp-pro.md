# Benchmark — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:52:43.663Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.75 MB, peak 155.61 MB (Δ 4.86 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 81.40 ms | 47.24 ms | 52.91 ms | — | — | 84.4 KB | 20,369 | 0 |
| `Roman Empire` | multi | 47.70 ms | 47.21 ms | 48.76 ms | — | — | 8.4 KB | 2,041 | 0 |
| `the capital of` | phrase | 48.79 ms | 47.69 ms | 48.12 ms | — | — | 7.2 KB | 1,777 | 0 |
| `phlogiston` | rare | 42.90 ms | 42.47 ms | 43.27 ms | — | — | 33 B | 9 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 1.49 ms | 0.39 ms | 0.48 ms | 2.1 KB |
| large | `Encyclopedia/E/English Law.md` | 5.39 ms | 3.68 ms | 3.76 ms | 389.3 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 2.98 ms | 2.13 ms | 2.50 ms | 13.2 KB |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
