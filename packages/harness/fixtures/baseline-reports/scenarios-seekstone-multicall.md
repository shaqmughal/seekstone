# Scenarios — seekstone-multicall

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-08-04T12:49:06.775Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v26.0.0, 10 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 5 | 416.5 KB | 106,523 | 83.05 ms | 66.83 ms |
| roman-empire-extent | search-read | 5 | 159.5 KB | 41,397 | 36.84 ms | 33.59 ms |
| church-architecture | search-read | 5 | 98.8 KB | 25,298 | 37.23 ms | 30.19 ms |
| rome-hub-navigation | search-read | 4 | 3.0 KB | 1,016 | 11.25 ms | 8.69 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.3 KB | 634 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 924 |
| 3 | `read` | `Encyclopedia/C/Chemistry.md` | 407.1 KB | 104,141 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.1 KB | 806 |
| 5 | `get_backlinks` | `Sources/Combustion.md` | 59 B | 18 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 2.1 KB | 597 |
| 2 | `read` | `Reference/Empire.md` | 78.2 KB | 19,276 |
| 3 | `read` | `Sources/Macedonian Empire.md` | 69.4 KB | 18,931 |
| 4 | `read` | `Encyclopedia/H/Heroic Romances.md` | 9.7 KB | 2,576 |
| 5 | `get_backlinks` | `Reference/Empire.md` | 57 B | 17 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 1.8 KB | 510 |
| 2 | `read` | `Reference/Church.md` | 30.5 KB | 7,356 |
| 3 | `read` | `0 Inbox/Basilica.md` | 41.4 KB | 10,927 |
| 4 | `read` | `Encyclopedia/L/Lyons.md` | 24.8 KB | 6,435 |
| 5 | `get_backlinks` | `Reference/Church.md` | 235 B | 70 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 1.7 KB | 561 |
| 2 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
| 3 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
| 4 | `get_backlinks` | `MOCs/ancient-rome MOC.md` | 62 B | 23 |
