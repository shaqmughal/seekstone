# Scenarios — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-08-04T12:49:20.144Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v26.0.0, 10 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 416.8 KB | 106,612 | 79.49 ms | 68.42 ms |
| roman-empire-extent | search-read | 4 | 160.1 KB | 41,534 | 36.96 ms | 32.59 ms |
| church-architecture | search-read | 4 | 88.2 KB | 22,529 | 29.42 ms | 27.89 ms |
| rome-hub-navigation | search-read | 3 | 4.0 KB | 1,355 | 11.70 ms | 11.36 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.7 KB | 741 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 924 |
| 3 | `read` | `Encyclopedia/C/Chemistry.md` | 407.1 KB | 104,141 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.1 KB | 806 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 2.7 KB | 751 |
| 2 | `read` | `Reference/Empire.md` | 78.2 KB | 19,276 |
| 3 | `read` | `Sources/Macedonian Empire.md` | 69.4 KB | 18,931 |
| 4 | `read` | `Encyclopedia/H/Heroic Romances.md` | 9.7 KB | 2,576 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 2.8 KB | 775 |
| 2 | `read` | `Reference/Church.md` | 30.5 KB | 7,356 |
| 3 | `read` | `0 Inbox/Basilica.md` | 41.4 KB | 10,927 |
| 4 | `read` | `Sources/Catholic Apostolic Church.md` | 13.5 KB | 3,471 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 2.8 KB | 923 |
| 2 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
| 3 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
