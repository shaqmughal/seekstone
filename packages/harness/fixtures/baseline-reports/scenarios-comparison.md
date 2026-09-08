# Tokens per answered question — scenario comparison

> Generated 2026-09-07 · 5 runs per task · darwin/arm64 · Node v25.9.0

Total context an agent consumes to answer each question: one `context_pack` call on backends that support it, versus search → read ×K → backlinks everywhere else. Lower is better.

## Tokens (approx) per task

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 542 | 109,221 | 107,480 | 3,968 | 7,542 |
| roman-empire-extent | 1,111 | 42,169 | 42,305 | 22,978 | 122,816 |
| church-architecture | 1,100 | 25,916 | 23,048 | 15,537 | 17† |
| rome-hub-navigation | 632 | 1,016 | 1,350 | 1,942 | 1,581 |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

> † Search returned no hits — the task went unanswered. The payload is the cost of the failed attempt, not of an answer; a low number here is a retrieval failure, not a win.

## Payload bytes per task

| Task | seekstone | seekstone-multicall | fs | obsidian-mcp-rs | obsidian-tc |
| --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | 2.0 KB | 424.9 KB | 418.7 KB | 15.6 KB | 29.6 KB |
| roman-empire-extent | 4.0 KB | 161.2 KB | 161.8 KB | 90.6 KB | 490.9 KB |
| church-architecture | 4.0 KB | 100.1 KB | 89.4 KB | 57.6 KB | 56 B |
| rome-hub-navigation | 2.0 KB | 3.0 KB | 3.9 KB | 5.6 KB | 3.6 KB |

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
| phlogiston-theory | 1.0× | 201.5× | 198.3× | 7.3× | 13.9× |
| roman-empire-extent | 1.0× | 38.0× | 38.1× | 20.7× | 110.5× |
| church-architecture | 1.0× | 23.6× | 21.0× | 14.1× | —† |
| rome-hub-navigation | 1.0× | 1.6× | 2.1× | 3.1× | 2.5× |

## Adapters

- **seekstone**: Seekstone server (in-process function calls, no IPC)
- **seekstone-multicall**: Seekstone server (in-process function calls, no IPC) — ablation: context_pack disabled, forced down the search→read path
- **fs**: Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **obsidian-mcp-rs**: obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **obsidian-tc**: obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
