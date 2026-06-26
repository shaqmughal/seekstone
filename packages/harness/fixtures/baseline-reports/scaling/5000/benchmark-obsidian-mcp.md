# Benchmark — obsidian-mcp

- **Adapter:** obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-06-26T02:53:02.478Z
- **Runs per measurement:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.50 MB, peak 168.00 MB (Δ 17.50 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 454.68 ms | 411.04 ms | 439.60 ms | — | — | 384.2 KB | 104,492 | 0 |
| `Roman Empire` | multi | 432.38 ms | 407.02 ms | 417.08 ms | — | — | 10.9 KB | 3,034 | 0 |
| `the capital of` | phrase | 409.49 ms | 408.37 ms | 416.79 ms | — | — | 22.5 KB | 6,719 | 0 |
| `phlogiston` | rare | 389.59 ms | 392.90 ms | 398.09 ms | — | — | 1.5 KB | 389 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.65 ms | 0.23 ms | 0.24 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 3.67 ms | 3.60 ms | 3.75 ms | 781.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.47 ms | 0.10 ms | 0.15 ms | 30 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
