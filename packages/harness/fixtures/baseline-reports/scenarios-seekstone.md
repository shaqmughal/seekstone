# Scenarios — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-08-04T12:48:08.929Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v26.0.0, 10 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | context-pack | 1 | 2.0 KB | 551 | 43.84 ms | 36.14 ms |
| roman-empire-extent | context-pack | 1 | 4.0 KB | 1,115 | 28.54 ms | 25.77 ms |
| church-architecture | context-pack | 1 | 4.0 KB | 1,084 | 29.76 ms | 30.09 ms |
| rome-hub-navigation | context-pack | 1 | 2.0 KB | 630 | 153.64 ms | 150.15 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `phlogiston` | 2.0 KB | 551 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `Roman Empire` | 4.0 KB | 1,115 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `church architecture nave` | 4.0 KB | 1,084 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `ancient-rome MOC` | 2.0 KB | 630 |
