# Scenarios — seekstone-multicall

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-09-07T04:07:54.469Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 5 | 424.9 KB | 109,221 | 85.00 ms | 55.65 ms |
| roman-empire-extent | search-read | 5 | 161.2 KB | 42,169 | 26.85 ms | 24.15 ms |
| church-architecture | search-read | 5 | 100.1 KB | 25,916 | 24.89 ms | 21.50 ms |
| rome-hub-navigation | search-read | 4 | 3.0 KB | 1,016 | 7.46 ms | 5.52 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.3 KB | 637 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 940 |
| 3 | `read` | `Encyclopedia/C/Chemistry.md` | 408.9 KB | 104,949 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.2 KB | 841 |
| 5 | `get_backlinks` | `Sources/Combustion.md` | 6.6 KB | 1,854 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 2.1 KB | 602 |
| 2 | `read` | `Reference/Empire.md` | 79.1 KB | 19,637 |
| 3 | `read` | `Sources/Macedonian Empire.md` | 70.1 KB | 19,273 |
| 4 | `read` | `Encyclopedia/H/Heroic Romances.md` | 9.8 KB | 2,640 |
| 5 | `get_backlinks` | `Reference/Empire.md` | 57 B | 17 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 1.8 KB | 510 |
| 2 | `read` | `Reference/Church.md` | 30.9 KB | 7,539 |
| 3 | `read` | `0 Inbox/Basilica.md` | 41.9 KB | 11,143 |
| 4 | `read` | `Encyclopedia/L/Lyons.md` | 25.3 KB | 6,654 |
| 5 | `get_backlinks` | `Reference/Church.md` | 235 B | 70 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 1.7 KB | 561 |
| 2 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
| 3 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
| 4 | `get_backlinks` | `MOCs/ancient-rome MOC.md` | 62 B | 23 |
