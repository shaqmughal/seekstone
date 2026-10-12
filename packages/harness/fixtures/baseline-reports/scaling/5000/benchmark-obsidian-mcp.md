# Benchmark — obsidian-mcp

- **Adapter:** obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-10-12T23:00:18.778Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 157.13 MB, peak 185.95 MB (Δ 28.83 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 438.41 ms | 388.98 ms | 403.44 ms | — | — | 385.9 KB | 105,321 | 0 |
| `Roman Empire` | multi | 370.00 ms | 379.68 ms | 393.32 ms | — | — | 10.9 KB | 3,036 | 0 |
| `the capital of` | phrase | 407.46 ms | 389.49 ms | 423.85 ms | — | — | 22.5 KB | 6,745 | 0 |
| `phlogiston` | rare | 382.28 ms | 361.00 ms | 373.74 ms | — | — | 1.5 KB | 389 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 0.57 ms | 0.17 ms | 0.26 ms | 2.1 KB |
| large | `Encyclopedia/I/Italy.md` | 2.95 ms | 2.81 ms | 3.41 ms | 784.0 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 0.20 ms | 0.06 ms | 0.10 ms | 30 B |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
