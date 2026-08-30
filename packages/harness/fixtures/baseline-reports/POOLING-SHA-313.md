# SHA-313 — hub-note demotion: dev-split pooling eval (2026-08-30)

**Question.** Note scores are the max over chunk scores. Do giant hub notes
(Japan, India, Asia, Australia — hundreds of chunks each) win by holding
hundreds of lottery tickets, and does a length-aware pooling fix the misses?

**Method.** `npm run harness -- retrieval --experiments --split dev --runs 10 --model <ids>`
on the committed 10k fixture, dev split only (90 queries: 54 semantic / 18
lexical / 18 topical). Every pooling runs through the shipped hybrid routing.
Poolings: `max` (control), `top2mean`, `logdiscount λ ∈ {0.01, 0.02, 0.04}`
(`best − λ·ln(chunks)`), `softmax τ ∈ {0.02, 0.05, 0.1, 0.2}`. Same dot
products for every pooling — only the aggregation differs.
Full tables: `pooling-dev-potion-retrieval-32M.{json,md}`, `pooling-dev-potion-base-8M.{json,md}`.

## Results — hit@5 on the dev split (hybrid routing)

| Pooling | 32M overall | 32M sem | 32M top | 8M overall | 8M sem | 8M top | Flips vs max (32M / 8M) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| max (shipped) | 81.1 | 81.5 | 61.1 | 72.2 | 70.4 | 50.0 | — |
| logdiscount λ=0.01 | **82.2** | 81.5 | 66.7 | **73.3** | 72.2 | 50.0 | +2 −1 / +1 −0 |
| logdiscount λ=0.02 | 82.2 | 81.5 | 66.7 | 72.2 | 70.4 | 50.0 | +3 −2 / +2 −2 |
| logdiscount λ=0.04 | 77.8 | 75.9 | 61.1 | 71.1 | 72.2 | 44.4 | — / +4 −5 (incl. a lexical loss) |
| top2mean | 75.6 | 68.5 | **72.2** | 68.9 | 63.0 | 55.6 | +3 −8 / +3 −6 |
| softmax τ=0.05 | 81.1 | 81.5 | 61.1 | 72.2 | 70.4 | 50.0 | +3 −3 / +2 −2 |
| softmax τ=0.1 | 78.9 | 77.8 | 61.1 | 73.3 | 74.1 | 50.0 | — / +4 −3 (incl. a lexical loss) |

Lexical subset stays 100% under every candidate except λ=0.04 and τ≥0.1 at
8M (routing unaffected; those poolings changed the semantic fallback for one
exact-term query). Warm p95 is flat: 32M 23.3 ms (max) vs 23.4–25.1 ms across
the grid; 8M 14.2 ms vs 13.9–14.7 ms — softmax's `exp()` costs ≈1 ms, the
others nothing. R4 holds.

## What the per-query view says

Every flip is rank-5↔8 boundary movement, not a structural change:

- `sem-jaguar` 32M: target rank 8 (max) → 6 (λ=0.01) → 5 (λ=0.02). A win, by one place.
- `sem-cotton`: the long, *relevant* Cotton note drops 5 → 8 → >10 (32M) and 3 → 4 → >10 (8M) as λ grows — the PRD's over-correction risk, observed.
- `sem-haydn`: 5 → 5 → 8.

The named hub misses do **not** respond to demotion:

| Query (8M, dev) | target rank: max | λ=0.01 | λ=0.02 | λ=0.04 | top2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| sem-japan | >10 | >10 | >10 | >10 | 7 |
| sem-machiavelli | >10 | >10 | >10 | >10 | 5 |
| sem-jaguar | >10 | >10 | >10 | >10 | >10 |
| sem-giraffe | >10 | >10 | >10 | >10 | >10 |
| sem-llama | >10 | 10 | 3 | 3 | >10 |
| top-weather | >10 ×3 | >10 ×3 | >10 ×3 | >10 ×3 | >10 ×3 |

Demoting the hubs removes them from the top 5 but does not surface the
target — for `sem-jaguar` at 8M the max-pool top 3 is *Canachus, Leprosy,
Lynx*, not hubs. The specific article's best chunk simply scores low: a
mean-pooled static embedding dilutes the discriminating terms ("largest wild
cat", "American continent") into topic words. That is a token-level evidence
problem (SHA-314 MaxSim), not a pooling problem. At 32M, giraffe / llama /
machiavelli are already hits under plain max — the bigger model, not pooling,
fixed them.

`top2mean` is the only pooling that moves topical (+11 pts at 32M), and it
pays 13 pts on the semantic subset — a trade, not a win.

## Decision

**No default change.** The pre-registered acceptance rule for this issue was
"dev-split semantic AND topical both improve vs max-pool". The best
candidate (λ=0.01) improves one subset per model, by one query each
(+1/90), with the mechanism above explaining why the headroom is small. A
dev-tuned parameter with ±1-query evidence does not earn a place in the
shipped ranking — it would be noise presented as a win.

What lands: the pooling machinery (`@seekstone/core` `PoolAccumulator`,
`SemanticStore(dim, pooling)`, the harness `--experiments` grid) — zero
latency cost, unit-tested, and the candidate stage SHA-314's rerank will
consume. `DEFAULT_POOLING` stays `max`.

**R2 (chunk-level ranking, per-note cap) was not run as a condition:** for
note-level hit@5 it is identical to max-pooling by construction (the first
chunk of each note in chunk-ranked order *is* that note's max). It only
changes results if the tool returns multiple chunks per note, which grows
payload — out of bounds for this epic.
