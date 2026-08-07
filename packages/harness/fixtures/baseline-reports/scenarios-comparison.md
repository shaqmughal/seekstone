# Tokens per answered question — scenario comparison

> Generated 2026-08-04 · 5 runs per task · darwin/arm64 · Node v26.0.0

Total context an agent consumes to answer each question: one `context_pack` call on backends that support it, versus search → read ×K → backlinks everywhere else. Lower is better.

## Tokens (approx) per task

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 551 | 106,523 | 106,612 | 3,861 | 7,410 |
| roman-empire-extent | 1,115 | 41,397 | 41,534 | 22,550 | 120,619 |
| church-architecture | 1,084 | 25,298 | 22,529 | 15,172 | 17† |
| rome-hub-navigation | 630 | 1,016 | 1,355 | 1,942 | 1,581 |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

> † Search returned no hits — the task went unanswered. The payload is the cost of the failed attempt, not of an answer; a low number here is a retrieval failure, not a win.

## Payload bytes per task

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 2.0 KB | 416.5 KB | 416.8 KB | 15.3 KB | 29.4 KB |
| roman-empire-extent | 4.0 KB | 159.5 KB | 160.1 KB | 89.6 KB | 485.8 KB |
| church-architecture | 4.0 KB | 98.8 KB | 88.2 KB | 56.8 KB | 56 B |
| rome-hub-navigation | 2.0 KB | 3.0 KB | 4.0 KB | 5.6 KB | 3.6 KB |

## Calls per task

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 1 | 5 | 4 | 4 | 4 |
| roman-empire-extent | 1 | 5 | 4 | 4 | 4 |
| church-architecture | 1 | 5 | 4 | 4 | 1 |
| rome-hub-navigation | 1 | 4 | 3 | 3 | 3 |

## Context multiplier vs seekstone (tokens)

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 1.0× | 193.3× | 193.5× | 7.0× | 13.4× |
| roman-empire-extent | 1.0× | 37.1× | 37.3× | 20.2× | 108.2× |
| church-architecture | 1.0× | 23.3× | 20.8× | 14.0× | —† |
| rome-hub-navigation | 1.0× | 1.6× | 2.2× | 3.1× | 2.5× |

## Adapters

- **seekstone**: Seekstone server (in-process function calls, no IPC)
- **seekstone-multicall**: Seekstone server (in-process function calls, no IPC) — ablation: context_pack disabled, forced down the search→read path
- **fs**: Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **obsidian-mcp-rs**: obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **obsidian-tc**: obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
