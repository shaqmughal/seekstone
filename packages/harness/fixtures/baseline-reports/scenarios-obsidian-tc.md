# Scenarios — obsidian-tc

- **Adapter:** obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)
- **Snapshot:** 2026-08-04T12:55:22.545Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v26.0.0, 10 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 29.4 KB | 7,410 | 3574.86 ms | 3369.20 ms |
| roman-empire-extent | search-read | 4 | 485.8 KB | 120,619 | 3536.36 ms | 3403.19 ms |
| church-architecture† | search-read | 1 | 56 B | 17 | 3410.17 ms | 3386.12 ms |
| rome-hub-navigation | search-read | 3 | 3.6 KB | 1,581 | 3495.88 ms | 3502.31 ms |

> † Search returned no hits — the task went unanswered. The payload is the cost of the failed attempt, not of an answer; a low number here is a retrieval failure, not a win.

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 4.8 KB | 1,410 |
| 2 | `read` | `Sources/Combustion.md` | 8.2 KB | 2,000 |
| 3 | `read` | `Sources/Combustion.md` | 8.2 KB | 2,000 |
| 4 | `read` | `Sources/Combustion.md` | 8.2 KB | 2,000 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 7.7 KB | 2,326 |
| 2 | `read` | `Reference/Empire.md` | 159.4 KB | 39,431 |
| 3 | `read` | `Reference/Empire.md` | 159.4 KB | 39,431 |
| 4 | `read` | `Reference/Empire.md` | 159.4 KB | 39,431 |

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
