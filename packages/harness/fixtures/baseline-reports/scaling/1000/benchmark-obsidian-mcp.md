# Benchmark — obsidian-mcp

- **Adapter:** obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:52:46.592Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 153.69 MB, peak 158.50 MB (Δ 4.81 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 103.32 ms | 83.11 ms | 84.97 ms | — | — | 65.8 KB | 18,040 | 0 |
| `Roman Empire` | multi | 84.68 ms | 81.87 ms | 82.27 ms | — | — | 2.7 KB | 757 | 0 |
| `the capital of` | phrase | 84.01 ms | 82.88 ms | 83.64 ms | — | — | 4.1 KB | 1,201 | 0 |
| `phlogiston` | rare | 78.46 ms | 78.39 ms | 84.43 ms | — | — | 17 B | 4 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 0.60 ms | 0.22 ms | 0.26 ms | 2.0 KB |
| large | `Encyclopedia/E/English Law.md` | 1.52 ms | 1.57 ms | 1.72 ms | 389.2 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.39 ms | 0.09 ms | 0.15 ms | 30 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
