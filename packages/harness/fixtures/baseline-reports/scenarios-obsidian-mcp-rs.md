# Scenarios — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-09-07T04:08:04.365Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | search-read | 4 | 15.6 KB | 3,968 | 339.56 ms | 27.25 ms |
| roman-empire-extent | search-read | 4 | 90.6 KB | 22,978 | 48.85 ms | 46.96 ms |
| church-architecture | search-read | 4 | 57.6 KB | 15,537 | 42.06 ms | 42.00 ms |
| rome-hub-navigation | search-read | 3 | 5.6 KB | 1,942 | 39.56 ms | 39.14 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `phlogiston` | 2.7 KB | 762 |
| 2 | `read` | `Sources/Combustion.md` | 3.9 KB | 940 |
| 3 | `read` | `Encyclopedia/B/Black.md` | 5.8 KB | 1,425 |
| 4 | `read` | `Encyclopedia/K/Kirwan.md` | 3.2 KB | 841 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `Roman Empire` | 7.5 KB | 2,178 |
| 2 | `read` | `Reference/Empire.md` | 79.5 KB | 19,774 |
| 3 | `read` | `Encyclopedia/C/Comnenus.md` | 1.9 KB | 534 |
| 4 | `read` | `Encyclopedia/G/Gallienus.md` | 1.8 KB | 492 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `church architecture nave` | 7.5 KB | 2,125 |
| 2 | `read` | `Encyclopedia/D/Dunkeld.md` | 5.3 KB | 1,448 |
| 3 | `read` | `0 Inbox/Basilica.md` | 42.0 KB | 11,197 |
| 4 | `read` | `Encyclopedia/A/Arcade.md` | 2.8 KB | 767 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `search` | `ancient-rome MOC` | 4.5 KB | 1,510 |
| 2 | `read` | `MOCs/ancient-rome-studies MOC.md` | 529 B | 192 |
| 3 | `read` | `MOCs/ancient-rome MOC.md` | 657 B | 240 |
