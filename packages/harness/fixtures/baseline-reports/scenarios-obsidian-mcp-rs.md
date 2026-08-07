# Scenarios — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-08-04T12:53:33.511Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v26.0.0, 10 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 15.3 KB | 3,861 | 313.47 ms | 41.08 ms |
| roman-empire-extent | search-read | 4 | 89.6 KB | 22,550 | 88.48 ms | 79.49 ms |
| church-architecture | search-read | 4 | 56.8 KB | 15,172 | 70.02 ms | 72.31 ms |
| rome-hub-navigation | search-read | 3 | 5.6 KB | 1,942 | 67.48 ms | 68.88 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.7 KB | 762 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 924 |
| 3 | `read` | `Encyclopedia/B/Black.md` | 5.6 KB | 1,369 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.1 KB | 806 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 7.4 KB | 2,135 |
| 2 | `read` | `Reference/Empire.md` | 78.6 KB | 19,413 |
| 3 | `read` | `Encyclopedia/C/Comnenus.md` | 1.9 KB | 523 |
| 4 | `read` | `Encyclopedia/G/Gallienus.md` | 1.7 KB | 479 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 7.4 KB | 2,079 |
| 2 | `read` | `Encyclopedia/D/Dunkeld.md` | 5.1 KB | 1,386 |
| 3 | `read` | `0 Inbox/Basilica.md` | 41.6 KB | 10,981 |
| 4 | `read` | `Encyclopedia/A/Arcade.md` | 2.7 KB | 726 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 4.5 KB | 1,510 |
| 2 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
| 3 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
