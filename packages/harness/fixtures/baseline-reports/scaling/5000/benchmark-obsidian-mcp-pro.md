# Benchmark — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-10-12T21:01:23.695Z
- **Runs per measurement:** 20 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs
- **Process RSS:** before 156.53 MB, peak 191.81 MB (Δ 35.28 MB)

## Search

| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `church` | single | 301.51 ms | 197.34 ms | 206.76 ms | — | — | 303.8 KB | 73,209 | 0 |
| `Roman Empire` | multi | 201.99 ms | 200.88 ms | 204.13 ms | — | — | 14.2 KB | 3,445 | 0 |
| `the capital of` | phrase | 209.04 ms | 210.58 ms | 212.46 ms | — | — | 13.6 KB | 3,332 | 0 |
| `phlogiston` | rare | 188.77 ms | 189.01 ms | 190.85 ms | — | — | 5.9 KB | 1,438 | 0 |

> **Context tax.** Payload is the raw bytes returned for the query. Token count is encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text — per-model tokenizers differ in absolute counts, but cross-adapter ratios hold.

## Read

| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| small | `Encyclopedia/H/Hoole.md` | 1.32 ms | 0.35 ms | 0.45 ms | 2.2 KB |
| large | `Encyclopedia/I/Italy.md` | 8.22 ms | 6.49 ms | 7.23 ms | 784.2 KB |

## Tools

Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.

| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |
| --- | --- | ---: | ---: | ---: | ---: |
| `list_notes` | vault root | 6.30 ms | 5.62 ms | 7.21 ms | 12.2 KB |

> **Not supported by this backend:** `list_tags`, `list_tasks`, `context_pack`, `outline_note`, `get_backlinks`, `get_links`, `get_periodic_note`.

## Methodology notes

- **TTFR** (time-to-first-result) is measured via `searchStream`. Backends that return all results at once (e.g. REST) show `—` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.
- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated `warmUp()` measurement — TODO.
- RSS is process-level and includes the harness itself, not only the adapter.
