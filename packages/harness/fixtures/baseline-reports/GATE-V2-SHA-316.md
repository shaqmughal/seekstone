# SHA-316 — Gate v2: the pre-registered head-to-head verdict (2026-08-31)

**Verdict: FAIL — published with the same prominence a win would have gotten.**
Two of four clauses missed. The full matrix is the committed
`retrieval-eval-competitors.{json,md}`; the gate is computed in code
(`computeGateV2`, `packages/harness/src/retrieval/runner.ts`) and rendered in
that report. The configuration was frozen and recorded on SHA-316 before any
holdout number was seen; this was a single-shot run — no re-rolls.

## The gate (pre-registered in SHA-311)

On the held-out split (60 queries, untouched during all tuning), seekstone's
shipped quality mode must: (1) beat obsidian-tc-graph's overall hit@5,
re-measured in the same run; (2) keep the lexical subset at 100% via routing;
(3) warm end-to-end p95 ≤ 30 ms @ 10k notes; (4) zero new runtime deps, zero
native modules, fully offline.

## Result — holdout split (n = 60)

| Condition | overall | semantic | lexical | topical | warm p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **seekstone shipped (32M + MaxSim, hybrid)** | 91.7% | 97.2% | 100% | 66.7% | 64 / 99 ms |
| obsidian-tc semantic | 88.3% | 91.7% | 100% | 66.7% | 222 / 239 ms |
| **obsidian-tc GraphRAG** | **95.0%** | 100% | 100% | 75.0% | 850 / 5,668 ms |

- Clause 1 — beat tc-graph: **FAIL**, 91.7% vs 95.0% (a 2-query gap at n=60).
- Clause 2 — lexical 100%: **PASS**.
- Clause 3 — p95 ≤ 30 ms: **FAIL**, 99.2 ms. Not a fluke of this run's
  concurrent Ollama load: the quiet-machine committed baseline for the same
  condition was 59.1 ms. The 30 ms budget was pre-registered before SHA-314
  landed; the MaxSim stage that bought +9 points of holdout hit@5 costs
  ~25–40 ms at 32M dims. The budget and the quality win were incompatible,
  and the gate is the gate.
- Clause 4 — zero new deps/offline: **PASS** (same 7 pure-JS runtime deps).

## What IS true (the concession-symmetry ledger)

- Seekstone's shipped quality mode **beats tc's plain semantic on holdout**
  (91.7% vs 88.3%) and effectively ties it overall (88.7% vs 89.3%) — from an
  8M/32M-parameter static model running in-process, offline, with no second
  server. SHA-308's era gap (72.2% vs ~90%) is closed.
- tc-graph's win costs: **13× our p50 / 57× our p95** per query
  (850 ms / 5.7 s vs 64 / 99 ms), a **34-minute** cold index (vs our 52 s),
  ~7× the payload (14.9 KB vs ~2 KB), and a running Ollama + 137M-parameter
  model as infrastructure.
- obsidian-mcp-pro again **failed to index the 10k vault at all**
  ("Invalid string length" after 21 minutes) — its row is a result.

## Fixture caveat on tc-graph's margin (carry into any writeup)

SHA-315 established that this fixture's wikilinks are random by design and
1-hop expansion over them is unmeasurable — gated expansion was
metric-identical to baseline for seekstone. tc-graph's holdout margin over
its own plain semantic (+6.7 here; 0.0 on dev in this same run) is therefore
consistent with variance from noise edges, not graph signal. We publish the
loss anyway — the pre-registered clause compares against their best number,
and their best number is 95.0%. Fixture v2 (SHA-322, deterministic prose
cross-links) re-measures both sides on a graph that carries real signal.

## Default-mode decision (scope item 3)

**The 32M quality mode stays opt-in** (`SEEKSTONE_SEMANTIC_MODEL`); the 8M
model remains the `SEEKSTONE_SEMANTIC=1` default. Rationale: the gate's own
latency clause fails at 32M (59–99 ms p95 measured) while 8M holds ~16 ms;
129 MB vs 30 MB download; ~2× cache; and the `.mcpb` one-click flow (SHA-309)
cannot set env vars yet, so a default flip would strand its users. Messaging
owns both numbers together, per the standing rule.

## What's next

1. Fixture v2 (SHA-322): prose cross-links, full re-baseline, re-tune
   SHA-315 expansion — the lever this gate run says we still need.
2. MaxSim latency work (candidate-count cap / early exit) if we re-attempt
   the 30 ms budget at 32M.
3. Re-run this gate, pre-registered again, when either lands.
