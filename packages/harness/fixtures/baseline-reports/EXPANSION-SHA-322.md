# SHA-322 — 1-hop graph expansion, re-tuned on fixture v2 (2026-09-05)

**Verdict: STILL NOT SHIPPED — but for a new reason. On fixture v1 expansion
was unmeasurable ([EXPANSION-SHA-315.md](./EXPANSION-SHA-315.md)); on fixture
v2 it is measurable, and it measures below the shipping bar.** The
implementation (`packages/server/src/semantic/expand.ts`) stays unwired; the
evidence changes from a null to a number.

**What changed under the eval.** Fixture v2 linkifies EB1911's prose
cross-references (deterministic, DF-filtered — see the SHA-322 generator),
adding 104,172 prose signal links (11.8/article) alongside the 26,624 random
noise-floor links. The v1 probe's blocker ("no expected note is 1-hop
reachable from any top-50 candidate") no longer holds: `Hawk.md` links
`[[Eagle]]` and `[[Kite]]` in body prose; Eagle carries 88 prose inbound.

**Method.** Same grid and invocation as SHA-315, unchanged (no new tuning
freedom): `retrieval --experiments --split dev --runs 20` per model on the
committed 10k fixture, dev split (90 queries: 54/18/18). Full tables:
`expand-dev-potion-base-8M.{json,md}`, `expand-dev-potion-retrieval-32M.{json,md}`.
Machine: darwin/arm64, node v25.9.0, 16 cpus (v1 grids ran on a different
machine — compare hit@5/MRR across files, not milliseconds).

## Results — hit@5 on the dev split (hybrid routing)

| Condition | 8M overall | 8M sem | 8M top | 32M overall | 32M sem | 32M top |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| maxsim-idf-b50 baseline (ships, SHA-314) | 81.1 | 79.6 | 66.7 | 86.7 | 90.7 | 61.1 |
| xp-boost d40 (all 4 combos) | 81.1 | 79.6 | 66.7 | 86.7 | 90.7 | 61.1 |
| xp-boost d70 (all 5 combos incl. gate-off) | 77.8–80.0 | 77.8–79.6 | 55.6–61.1 | **87.8** | **92.6** | 61.1 |
| xp-rrf, best | 74.4 | 70.4 | 61.1 | 85.6 | 85.2 | **72.2** |

(32M baseline dev metrics are identical to v1's — a well-controlled
comparison: the fixture change moved the graph, not the 32M ranking.)

Three findings:

1. **Expansion finally does something.** On v1 every gated combo was
   metric-identical to baseline and gate-off was strictly worse — a null.
   On v2 the knobs have effects in both directions: at 32M every decay-0.7
   boost combo (gate and cap invariant, gate-off included) beats the
   baseline — **+1.1 overall / +1.9 semantic, ~0 latency cost** — while at
   8M decay-0.7 is net-negative (down to −3.3 overall; hub-noise still beats
   signal at 8M's tighter score margins) and decay-0.4 changes nothing.
2. **The gain is real but thin: one dev query** (`sem-chlorine`, rescued by
   prose-link neighbors at 32M). One flipped query = 1.1 pts on a 90-query
   dev split. Deterministic, robust across 5 combos — but a single query is
   not a shippable margin, and the holdout split stays unread outside a
   pre-registered gate run.
3. **The graph carries topical signal the current fusion can't cash.**
   xp-rrf reaches **72.2 topical (+11.1 over baseline)** on 32M — the
   subset SHA-311 called the open ground — but pays −5.5 semantic for it,
   because rank-fusion dilutes the strong semantic ranking to let graph
   neighbors in. A fusion that spends graph evidence only where the
   semantic ranking is weak is the concrete gate-v3 lever this measurement
   surfaces.

## Disposition

- `expand.ts` stays unwired; shipped pipeline unchanged (scan + MaxSim). No
  changeset.
- The xp grid stays behind `--experiments`, unchanged — these numbers came
  from the pre-existing grid, no post-hoc tuning freedom was added.
- Revisit at the gate-v3 composition: (a) 32M d70 boost as a
  cheap +1 candidate, (b) a semantic-confidence-gated fusion targeting the
  +11 topical headroom without the semantic tax.
- The v1 caveat about obsidian-tc's GraphRAG (+2 on a signal-free graph =
  likely noise) now has a live counterpart: v2 gives tc-graph a real graph
  to expand over — the competitor re-run under this canon re-judges that
  comparison fairly in both directions.
