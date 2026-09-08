# Scenarios — seekstone

- **Adapter:** Seekstone server (in-process function calls, no IPC)
- **Snapshot:** 2026-09-07T04:01:34.122Z
- **Runs per task:** 5 (cold = run 1; warm = runs 2..N)
- **Machine:** darwin/arm64, Node v25.9.0, 16 logical CPUs

Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.

| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| phlogiston-theory | context-pack | 1 | 2.0 KB | 542 | 219.76 ms | 210.99 ms |
| roman-empire-extent | context-pack | 1 | 4.0 KB | 1,111 | 187.29 ms | 185.15 ms |
| church-architecture | context-pack | 1 | 4.0 KB | 1,100 | 155.96 ms | 153.35 ms |
| rome-hub-navigation | context-pack | 1 | 2.0 KB | 632 | 117.19 ms | 116.13 ms |

> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.

## Step breakdown (run 1)

### phlogiston-theory

> What was the phlogiston theory and which chemists overturned it?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `phlogiston` | 2.0 KB | 542 |

### roman-empire-extent

> What did the Roman Empire comprise at its greatest extent?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `Roman Empire` | 4.0 KB | 1,111 |

### church-architecture

> How is a mediaeval church laid out architecturally?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `church architecture nave` | 4.0 KB | 1,100 |

### rome-hub-navigation

> Which articles does the ancient-rome map of content link to?

| # | Call | Target | Payload | Tokens (approx) |
| ---: | --- | --- | ---: | ---: |
| 1 | `context_pack` | `ancient-rome MOC` | 2.0 KB | 632 |
