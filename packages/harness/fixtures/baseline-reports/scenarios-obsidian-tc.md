# Scenarios — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-09-07T04:09:00.421Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 29.6 KB | 7,542 | 2774.84 ms | 2672.73 ms |
| roman-empire-extent | search-read | 4 | 490.9 KB | 122,816 | 2794.95 ms | 2775.53 ms |
| church-architecture† | search-read | 1 | 56 B | 17 | 2619.04 ms | 2615.11 ms |
| rome-hub-navigation | search-read | 3 | 3.6 KB | 1,581 | 2737.68 ms | 2728.80 ms |

> † Search returned no hits — the task went unanswered. The payload is the cost of the failed attempt, not of an answer; a low number here is a retrieval failure, not a win.

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 4.8 KB | 1,422 |
| 2 | `read` | `Sources/Combustion.md` | 8.3 KB | 2,040 |
| 3 | `read` | `Sources/Combustion.md` | 8.3 KB | 2,040 |
| 4 | `read` | `Sources/Combustion.md` | 8.3 KB | 2,040 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 7.7 KB | 2,336 |
| 2 | `read` | `Reference/Empire.md` | 161.0 KB | 40,160 |
| 3 | `read` | `Reference/Empire.md` | 161.0 KB | 40,160 |
| 4 | `read` | `Reference/Empire.md` | 161.0 KB | 40,160 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 56 B | 17 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 286 B | 103 |
| 2 | `read` | `MOCs/ancient-rome MOC.md` | 1.6 KB | 739 |
| 3 | `read` | `MOCs/ancient-rome MOC.md` | 1.6 KB | 739 |
