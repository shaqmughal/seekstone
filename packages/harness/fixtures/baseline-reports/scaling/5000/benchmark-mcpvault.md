# Benchmark — mcpvault

- **Adapter:** mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)
- **Snapshot:** 2026-06-26T01:55:35.007Z
- **Runs per measurement:** 10 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 150.56 MB, peak 169.78 MB (Δ 19.22 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 464.14 ms | 424.56 ms | 448.19 ms | — | — | 2.3 KB | 731 | 10 |
| `Roman Empire` | multi | 548.23 ms | 516.98 ms | 542.18 ms | — | — | 2.5 KB | 797 | 10 |
| `the capital of` | phrase | 528.11 ms | 528.93 ms | 534.61 ms | — | — | 2.3 KB | 780 | 10 |
| `phlogiston` | rare | 396.76 ms | 393.74 ms | 403.35 ms | — | — | 684 B | 216 | 3 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.18 ms | 0.31 ms | 0.41 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 8.36 ms | 5.32 ms | 5.69 ms | 794.6 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 2.89 ms | 0.28 ms | 0.53 ms | 165 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
