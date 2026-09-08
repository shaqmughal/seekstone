# Benchmark — mcpvault

- **Adapter:** mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)
- **Snapshot:** 2026-09-07T03:38:59.283Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 152.33 MB, peak 181.06 MB (Δ 28.73 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 905.51 ms | 786.14 ms | 831.20 ms | — | — | 2.3 KB | 714 | 10 |
| `Roman Empire` | multi | 1037.15 ms | 992.63 ms | 1028.94 ms | — | — | 2.2 KB | 711 | 10 |
| `the capital of` | phrase | 1035.26 ms | 1028.83 ms | 1053.59 ms | — | — | 2.2 KB | 748 | 10 |
| `phlogiston` | rare | 781.85 ms | 780.77 ms | 846.31 ms | — | — | 2.1 KB | 650 | 9 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/A/Anglesite.md` | 1.18 ms | 0.30 ms | 0.38 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 7.59 ms | 4.72 ms | 7.58 ms | 799.3 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.78 ms | 0.30 ms | 1.17 ms | 165 B |

> **Not supported by this backend:** `list_tags`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
