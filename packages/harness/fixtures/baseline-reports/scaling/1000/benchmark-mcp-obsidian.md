# Benchmark — mcp-obsidian

- **Adapter:** mcp-obsidian (MarkusPfundstein, REST API, requires Obsidian running)
- **Snapshot:** 2026-06-26T03:26:05.561Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 151.00 MB, peak 863.56 MB (Δ 712.56 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 48.28 ms | 25.06 ms | 27.74 ms | — | — | 425.4 KB | 112,716 | 223 |
| `Roman Empire` | multi | 32.70 ms | 27.75 ms | 28.50 ms | — | — | 311.8 KB | 81,650 | 44 |
| `the capital of` | phrase | 587.49 ms | 583.64 ms | 590.25 ms | — | — | 38.40 MB | 10,152,273 | 113 |
| `phlogiston` | rare | 31.55 ms | 18.04 ms | 20.88 ms | — | — | 2 B | 1 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken `cl100k_base`.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/B/Bauernfeld.md` | 9.44 ms | 6.21 ms | 7.47 ms | 2.0 KB |
| large | `Encyclopedia/E/English Law.md` | 8.24 ms | 9.55 ms | 11.17 ms | 395.7 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 9.91 ms | 8.02 ms | 9.18 ms | 184 B |

> **Not supported by this backend:** `list_tags`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
