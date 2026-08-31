# SHA-315 — 1-hop graph expansion: dev-split eval (2026-08-30)

**Verdict: NOT SHIPPED — unmeasurable on this fixture, and provably so.**
The implementation (`packages/server/src/semantic/expand.ts`) is complete,
unit-tested, and evaluated, but is deliberately not wired into the search
pipeline. This document records why, because the *why* is a finding about the
benchmark fixture, not about the technique.

**Question.** obsidian-tc's GraphRAG mode — vector seeds expanded through the
wikilink graph, RRF-fused — is its best condition (92% overall vs 90% plain
semantic on our baseline) and costs it 2.7 s p50 per query. The server holds
the same graph warm (backlink index + per-note outbound links), so the same
expansion costs link lookups plus a few hundred dot products. Does 1-hop
expansion of the SHA-314-reranked top-50 close the topical gap at ~zero
latency cost?

**Method.** `npm run harness -- retrieval --experiments --split dev --runs 20`
(and `--model potion-retrieval-32M` for the second file) on the committed 10k
fixture, dev split only (90 queries: 54 semantic / 18 lexical / 18 topical).
Every condition runs through the shipped hybrid routing with SHA-314-winner
(idf-b50) seeds. Grid: fusion (`boost` max-merge / `rrf`) × hopDecay
{0.4, 0.7} × per-seed cap {3, 5} × own-score gate {0.25, 0.35}, plus one
gate-disabled control (`g0`). Full tables:
`expand-dev-potion-base-8M.{json,md}`, `expand-dev-potion-retrieval-32M.{json,md}`.

## Results — hit@5 on the dev split (hybrid routing)

| Condition | 8M overall | 8M sem | 8M top | 8M p95 ms | 32M overall | 32M sem | 32M top | 32M p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| maxsim-idf-b50 baseline (ships, SHA-314) | 83.3 | 85.2 | 61.1 | 36 | 86.7 | 90.7 | 61.1 | 64 |
| xp-boost, every gated combo (8 of 8) | 83.3 | 85.2 | 61.1 | ~37 | 86.7 | 90.7 | 61.1 | ~64 |
| xp-boost gate-disabled control | 80.0 | 81.5 | 55.6 | 35 | 86.7 | 90.7 | 61.1 | 63 |
| xp-rrf, best | 82.2 | 85.2 | 55.6 | ~37 | 86.7 | 90.7 | 61.1 | 65 |

Three facts, and they compose into one conclusion:

1. **Every gated `boost` combination is metric-identical to the no-expansion
   baseline** — same hit@5, same MRR@10 to three decimals, on both models
   (verified programmatically against the JSON, all 8 combos each).
   Expansion changed the top-10 on 16/90 queries (8M), all below the hit@5
   line.
2. **The gate-disabled control is worse or a wash.** 8M: −3.3 overall, −5.5
   topical — turn the gate off and random-graph noise floods in and hurts.
   32M: metric-identical — the stronger model's larger score margins absorb
   the noise before it reaches the top 5. Either way the machinery works;
   what the gate filters out is *everything*, because everything is noise.
3. **RRF fusion is never better than the baseline on either model** —
   forcing rank-fusion with a signal-free expansion list can only dilute
   (worst 32M rrf combo: 85.6 overall, −1.1).

## Why: the fixture's graph carries no topical signal, by design

The golden-set rule (SHA-312) requires relevance labels to come from body
prose only, so the generator makes tags and See-also wikilinks RANDOM. What
SHA-315 surfaced: those random See-also links are essentially the *only*
links. The generator never linkifies EB1911's prose cross-references —
`Reference/Eagle.md` contains exactly one wikilink, `[[Luynes]]` (random;
its frontmatter topic is `astronomy`, also random). Across the vault:
~26.7k links over 10k notes, ~all label-independent.

A probe of the failing topical dev queries (`top-birds-of-prey`,
`top-weather`, `top-composers`) confirmed the structural consequence: **no
expected note is 1-hop reachable from any top-50 candidate**, and top-seed
neighborhoods are 0–15 random notes. The motivating scenario in the PRD —
"the Eagle article links Hawk and Kite in its body prose" — is false for
this fixture. No gate/decay/cap setting can extract signal that is not
there, and further tuning on this vault would be fitting noise (the exact
failure mode the PRD's risk section forbade).

`top-birds-of-prey` specifically (PRD acceptance criterion): expected
Eagle/Hawk/Kite sit at stage-1 ranks ≈100+ with no top-50 linkers; expansion
cannot flip it. The writeup explains why instead — as required.

## What this says about tc-graph's 92%

obsidian-tc's GraphRAG win (+2 pts over its own plain semantic) was measured
on this same random-link fixture. If link expansion provably carries no
topical signal here, that +2 is very likely noise, not GraphRAG earning its
2.7 s/query. Carry this into the SHA-316 writeup with the usual hedging —
it's a measured observation about the fixture, not a claim about tc on real
vaults.

## Latency (for completeness — cost was never the problem)

Expansion adds ~0.5–1 ms p50 on top of the MaxSim stage (8M: 27.7 → 28.2 ms;
32M: 49.0 → 50.1 ms — in the harness ranker, which even re-scans at full
depth). Latency was never the constraint.

## Disposition

- `expand.ts` + unit tests stay in `packages/server/src/semantic/` (header
  documents the unwired status); the harness `xp-*` grid stays behind
  `--experiments`, so the eval keeps exercising the real implementation.
- Shipped search pipeline is unchanged (two stages: scan + MaxSim rerank).
  No changeset — nothing user-visible changed.
- Re-tune on a fixture with real prose cross-links: SHA-322 (generator
  linkifies EB1911 headword mentions deterministically; full re-baseline).
- Conservative-bound caveat from the PRD is superseded: the fixture isn't a
  *noisy* measurement of expansion, it's a *null* one. Real vaults with
  meaningful link graphs remain the plausible-win case — unproven until
  SHA-322.
