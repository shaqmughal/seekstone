# SHA-314 — static late-interaction MaxSim rerank: dev-split eval (2026-08-30)

**Question.** Mean-pooled query vectors dilute discriminating tokens ("lead
sulphate") into topic mass ("mineral"). Does a ColBERT-style MaxSim rerank of
the stage-1 top-50 — per query token, max cosine over the candidate chunk's
static token vectors — recover those misses without blowing the latency
budget?

**Method.** `npm run harness -- retrieval --experiments --split dev --runs 20`
(and `--model potion-retrieval-32M` for the second file) on the committed 10k
fixture, dev split only (90 queries: 54 semantic / 18 lexical / 18 topical).
Every condition runs through the shipped hybrid routing. Grid: aggregation
(`sum`/`mean`) × candidate-set IDF weighting × fusion weight β ∈ {0.5, 0.7, 1}
(β = weight on the MaxSim score after per-list min-max normalization; β=1 is a
pure rerank). Token ids per chunk are computed once at index build — WordPiece
tokenization of 50 candidates dominated query latency (~23 ms of ~52) before
that change; the shipped server memoizes them lazily per note instead.
Full tables: `maxsim-dev-potion-base-8M.{json,md}`, `maxsim-dev-potion-retrieval-32M.{json,md}`.

## Results — hit@5 on the dev split (hybrid routing)

| Condition | 8M overall | 8M sem | 8M top | 8M p95 ms | 32M overall | 32M sem | 32M top | 32M p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| route baseline (shipped pre-SHA-314) | 72.2 | 70.4 | 50.0 | 14 | 81.1 | 81.5 | 61.1 | 24 |
| maxsim β=1 (mean) | 77.8 | 85.2 | 33.3 | 26 | 80.0 | 87.0 | 38.9 | 50 |
| maxsim-idf β=1 | 76.7 | 81.5 | 38.9 | 27 | 75.6 | 83.3 | 27.8 | 49 |
| maxsim-mean β=0.5 | 82.2 | 83.3 | 61.1 | 26 | **87.8** | **90.7** | 66.7 | 50 |
| maxsim-mean β=0.7 | 82.2 | **87.0** | 50.0 | 26 | 86.7 | 88.9 | 66.7 | 50 |
| **maxsim-idf β=0.5 (ships)** | **83.3** | 85.2 | **61.1** | 27 | 86.7 | **90.7** | 61.1 | 49 |
| maxsim-idf β=0.7 | 80.0 | 85.2 | 44.4 | 27 | 83.3 | 85.2 | 61.1 | 49 |

Lexical stays 100% under every condition (routing runs before the rerank and
is untouched). β=1 shows the raw signal: strong on semantic, destructive on
topical — multi-note topical queries need stage-1's pooled vote. Fusion keeps
both.

## What the per-query view says

**8M, idf-β0.5 vs baseline: 10 gains, 0 losses** — the only zero-regression
condition (`sem-giraffe`, `sem-fog`, `sem-llama`, `sem-machiavelli`,
`sem-carnival`, `sem-labyrinth`, `sem-lacrosse`, `sem-haydn`,
`top-textiles`, `top-great-rivers`). mean-β0.7 flips more (incl.
`sem-anglesite` and `sem-japan`) but pays with `sem-faraday`, `sem-brick`,
`top-diseases`.

**32M, idf-β0.5: 6 gains, 1 loss** (`sem-jaguar`, `sem-fox-statesman` → rank
1, `sem-astrolabe`, `sem-crown-coin`, `sem-grasshopper`, `sem-labyrinth`;
loss: `sem-chlorine`). mean-β0.5 edges it overall (87.8 vs 86.7, +1 query)
— within noise of the 8M-chosen config; one shipped constant serves both.

The PRD's four named misses:

| Query | 8M: base → idf-β0.5 | 32M: base → idf-β0.5 |
| --- | --- | --- |
| sem-fog | 6 → **1** | >10 → >10 |
| sem-anglesite | >10 → >10 (rank 2–5 under β=1/β0.7 mean) | >10 → >10 |
| sem-guillotine | >10 → >10 | 4 → **3** |
| sem-fox-statesman | >10 → >10 | 6 → **1** |

`sem-guillotine` and `sem-fox-statesman` cannot flip at 8M: their targets are
**absent from the stage-1 top-50 entirely** (probe-verified) — a rerank can
only reorder what stage 1 surfaces. The 32M model fixes the candidate recall
and the rerank then finishes the job (fox: 6 → 1). Candidate recall is
SHA-315 graph-expansion / model-choice territory, not a rerank defect.
`sem-anglesite` flips only under configs that lose elsewhere — recorded as
the known tradeoff of the shipped constant.

## Latency

Same-query warm end-to-end (embed + scan + rerank + fuse), 20 runs:

- **potion-base-8M (default): 27 ms p95** (22 median) vs 14 ms baseline —
  inside the pre-registered ≤30 ms budget. The rerank's cost is one
  similarity dot per *unique* candidate token per query token
  (`maxsimScoreTokens` memoizes by vocab id), over pre-tokenized chunk ids.
- **potion-retrieval-32M (opt-in): 49 ms p95** (38 median) vs 24 ms baseline
  — **over the 30 ms budget**. 512-dim doubles the dot work. Recorded as a
  known deviation: the 32M model is the explicit quality-over-speed opt-in
  (SHA-310), and the rerank buys it +9.2 pts semantic hit@5. If gate v2
  needs it under 30 ms, the levers are rerank depth (50 → ~20) or a
  per-chunk token cap — both untuned here to keep one shipped config.

## Decision

**Ship maxsim-idf β=0.5** (mean aggregation, candidate-set IDF, fusion 0.5)
behind semantic + hybrid search: dev-split semantic AND topical both improve
on the default model with zero per-query regressions, lexical routing is
untouched, and the default model meets the latency budget. Constants live in
`packages/server/src/semantic/rerank.ts`; the excerpt still shows stage-1's
best-matching chunk (only note order moves). No cache format change — token
ids are memoized in memory per note and dropped on watcher change. The
committed `--shipped` baseline (`retrieval-eval.{json,md}`, SHA-310) predates
the rerank; gate v2 (SHA-316) re-runs it on the holdout split.
