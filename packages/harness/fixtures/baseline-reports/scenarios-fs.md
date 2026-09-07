# Scenarios — fs

- **Adapter:** Filesystem-direct (MiniSearch in-process, no HTTP round-trip)
- **Snapshot:** 2026-09-07T04:08:02.016Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 418.7 KB | 107,480 | 63.90 ms | 54.26 ms |
| roman-empire-extent | search-read | 4 | 161.8 KB | 42,305 | 25.68 ms | 22.86 ms |
| church-architecture | search-read | 4 | 89.4 KB | 23,048 | 19.41 ms | 18.08 ms |
| rome-hub-navigation | search-read | 3 | 3.9 KB | 1,350 | 8.23 ms | 6.72 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.7 KB | 750 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 940 |
| 3 | `read` | `Encyclopedia/C/Chemistry.md` | 408.9 KB | 104,949 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.2 KB | 841 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 2.7 KB | 755 |
| 2 | `read` | `Reference/Empire.md` | 79.1 KB | 19,637 |
| 3 | `read` | `Sources/Macedonian Empire.md` | 70.1 KB | 19,273 |
| 4 | `read` | `Encyclopedia/H/Heroic Romances.md` | 9.8 KB | 2,640 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 2.8 KB | 766 |
| 2 | `read` | `Reference/Church.md` | 30.9 KB | 7,539 |
| 3 | `read` | `0 Inbox/Basilica.md` | 41.9 KB | 11,143 |
| 4 | `read` | `Sources/Catholic Apostolic Church.md` | 13.9 KB | 3,600 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 2.8 KB | 918 |
| 2 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
| 3 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
