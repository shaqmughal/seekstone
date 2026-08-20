/**
 * Retrieval-quality eval runner (SHA-257 spike): scores lexical, semantic,
 * and hybrid-RRF retrieval against the golden query set and computes the
 * pre-registered ship gate.
 *
 * Pre-registered gate (fixed before any numbers were seen): hybrid RRF must
 * beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2
 * points on the lexical (exact-term) subset, and warm end-to-end semantic
 * query (embed + scan) p95 must be ≤15 ms at 10k notes. A semantic-subset
 * gain of +5..+10 points is the discuss zone. Model choice = smallest model
 * passing.
 */
import { cpus } from 'node:os';
import { join } from 'node:path';
import { type Embedder, loadModel2Vec } from '@seekstone/core/embed';
import { type Distribution, summarise } from '@seekstone/core/percentiles';
import { routeToLexical, type ScoredHit, wsumFuse } from './fusion.js';
import type { GoldenKind, GoldenQuery, GoldenSet } from './golden.js';
import { buildLexicalContext, rankLexicalScored } from './lexical.js';
import { hitAtK, mrrAtK } from './metrics.js';
import { rrfFuse } from './rrf.js';
import { buildSemanticIndex, rankSemanticScored, type SemanticIndex } from './semantic.js';

export const RETRIEVAL_DEPTH = 50;
export const HIT_K = 5;
export const MRR_K = 10;

export const GATE = {
  minSemanticDeltaHit5: 10,
  discussSemanticDeltaHit5: 5,
  maxLexicalRegressionHit5: 2,
  maxSemanticWarmP95Ms: 15,
} as const;

export interface ConditionMetrics {
  /** Percentage of queries with any expected path in the top 5 (0–100). */
  hit5: number;
  /** Mean reciprocal rank of the first expected path in the top 10. */
  mrr10: number;
  n: number;
}

export interface ConditionResult {
  condition: string;
  metrics: {
    overall: ConditionMetrics;
    semantic: ConditionMetrics;
    lexical: ConditionMetrics;
    topical: ConditionMetrics;
  };
  latency: { warm: Distribution };
}

export interface PerQueryCondition {
  hit5: boolean;
  rr10: number;
  top10: string[];
}

export interface PerQueryResult {
  id: string;
  kind: GoldenKind;
  query: string;
  expected: string[];
  conditions: Record<string, PerQueryCondition>;
}

export type GateVerdict = 'ship' | 'discuss' | 'no-ship';

export interface ModelGate {
  model: string;
  semanticDeltaHit5: number;
  lexicalDeltaHit5: number;
  semanticWarmP95Ms: number;
  verdict: GateVerdict;
  reasons: string[];
}

export interface GateResult {
  perModel: ModelGate[];
  verdict: GateVerdict;
  /** Smallest passing model, or null when none ships. */
  chosenModel: string | null;
}

export interface ModelInfo {
  modelId: string;
  dim: number;
  chunkCount: number;
  indexBuildMs: number;
  loadMs: number;
}

export interface RetrievalSummary {
  snapshotDate: string;
  machine: { platform: string; arch: string; node: string; cpus: number };
  vaultRoot: string;
  noteCount: number;
  querySet: { total: number; semantic: number; lexical: number; topical: number };
  runs: number;
  lexicalBuildMs: number;
  models: ModelInfo[];
  conditions: ConditionResult[];
  perQuery: PerQueryResult[];
  gate: GateResult;
}

export interface RetrievalEvalOptions {
  vaultRoot: string;
  goldenSet: GoldenSet;
  /** Root directory holding one subdir per model id. */
  modelsDir: string;
  /** Ordered smallest-first; gate picks the first passing model. */
  modelIds: string[];
  /** Timed executions per query for latency; run 1 is discarded as cold. */
  runs: number;
  log?: (msg: string) => void;
  /** Test seam; defaults to loadModel2Vec. */
  loadEmbedder?: (modelDir: string) => Promise<Embedder>;
  /**
   * Also evaluate the SHA-307 fusion candidates (top2mean pooling, query
   * routing, score-weighted fusion) for the FIRST model. Experimental
   * conditions appear in the tables but never affect the gate.
   */
  experiments?: boolean;
  /**
   * Also evaluate the server's ACTUAL search tool with mode semantic/hybrid
   * (first model only) — the shipped code path, using the real per-vault
   * embedding cache. This is the SHA-307 acceptance run.
   */
  shipped?: boolean;
}

interface ConditionAccumulator {
  condition: string;
  /** Ranking used for quality metrics; may reuse cached lexical rankings. */
  rank: (q: GoldenQuery) => string[];
  /** Ranking timed for latency; always does the full end-to-end work. */
  timedRank: (q: GoldenQuery) => string[];
}

export async function runRetrievalEval(opts: RetrievalEvalOptions): Promise<RetrievalSummary> {
  const log = opts.log ?? (() => {});
  const queries = opts.goldenSet.queries;
  const loadEmbedder = opts.loadEmbedder ?? loadModel2Vec;

  const lexical = await buildLexicalContext(opts.vaultRoot);
  log(`lexical index: ${lexical.noteCount} notes in ${Math.round(lexical.buildMs)} ms`);

  const models: ModelInfo[] = [];
  const embedders: Array<{ id: string; embedder: Embedder; index: SemanticIndex }> = [];
  for (const modelId of opts.modelIds) {
    const t0 = performance.now();
    const embedder = await loadEmbedder(join(opts.modelsDir, modelId));
    const loadMs = performance.now() - t0;
    const index = await buildSemanticIndex(opts.vaultRoot, embedder);
    log(
      `${modelId}: dim ${embedder.dim}, ${index.chunkCount} chunks over ${index.noteCount} notes in ${Math.round(index.buildMs)} ms`,
    );
    models.push({
      modelId,
      dim: embedder.dim,
      chunkCount: index.chunkCount,
      indexBuildMs: index.buildMs,
      loadMs,
    });
    embedders.push({ id: modelId, embedder, index });
  }

  // Lexical rankings are computed once per query and shared by every hybrid.
  const lexicalScored = new Map<string, ScoredHit[]>();
  for (const q of queries) {
    lexicalScored.set(q.id, rankLexicalScored(lexical.ctx, q.query, RETRIEVAL_DEPTH));
  }
  const lexPaths = (q: GoldenQuery) => (lexicalScored.get(q.id) as ScoredHit[]).map((h) => h.path);

  const conditions: ConditionAccumulator[] = [
    {
      condition: 'lexical',
      rank: lexPaths,
      timedRank: (q) => rankLexicalScored(lexical.ctx, q.query, RETRIEVAL_DEPTH).map((h) => h.path),
    },
  ];
  for (const [modelIdx, { id, embedder, index }] of embedders.entries()) {
    const semScored = (q: GoldenQuery, pooling: 'max' | 'top2mean' = 'max') =>
      rankSemanticScored(embedder, index, q.query, RETRIEVAL_DEPTH, pooling);
    const semantic = (q: GoldenQuery) => semScored(q).map((h) => h.path);
    conditions.push({ condition: `semantic:${id}`, rank: semantic, timedRank: semantic });
    conditions.push({
      condition: `hybrid-rrf:${id}`,
      rank: (q) => rrfFuse([lexPaths(q), semantic(q)]),
      timedRank: (q) =>
        rrfFuse([
          rankLexicalScored(lexical.ctx, q.query, RETRIEVAL_DEPTH).map((h) => h.path),
          semantic(q),
        ]),
    });
    if (opts.experiments && modelIdx === 0) {
      const semanticTop2 = (q: GoldenQuery) => semScored(q, 'top2mean').map((h) => h.path);
      const route = (pooling: 'max' | 'top2mean') => (q: GoldenQuery) =>
        routeToLexical(q.query, lexicalScored.get(q.id) as ScoredHit[])
          ? lexPaths(q)
          : semScored(q, pooling).map((h) => h.path);
      const wsum = (alpha: number) => (q: GoldenQuery) =>
        wsumFuse(lexicalScored.get(q.id) as ScoredHit[], semScored(q), alpha);
      for (const [name, fn] of [
        [`semantic-top2:${id}`, semanticTop2],
        [`hybrid-route:${id}`, route('max')],
        [`hybrid-route-top2:${id}`, route('top2mean')],
        [`hybrid-wsum70:${id}`, wsum(0.7)],
        [`hybrid-wsum85:${id}`, wsum(0.85)],
      ] as const) {
        conditions.push({ condition: name, rank: fn, timedRank: fn });
      }
    }
  }

  let shippedStop: (() => void) | undefined;
  if (opts.shipped && opts.modelIds[0]) {
    const { buildShipped } = await import('./shipped.js');
    const { defaultCacheDir } = await import('../../../server/src/semantic/config.js');
    const { homedir } = await import('node:os');
    const shipped = await buildShipped(
      lexical.ctx,
      join(opts.modelsDir, opts.modelIds[0]),
      defaultCacheDir(process.env, homedir()),
      opts.loadEmbedder,
    );
    shippedStop = shipped.stop;
    log(`shipped semantic index ready in ${Math.round(shipped.buildMs)} ms (real cache path)`);
    for (const mode of ['semantic', 'hybrid'] as const) {
      const fn = (q: GoldenQuery) => shipped.rank(mode)(q.query);
      conditions.push({
        condition: `shipped-${mode}:${opts.modelIds[0]}`,
        rank: fn,
        timedRank: fn,
      });
    }
  }

  const perQuery: PerQueryResult[] = queries.map((q) => ({
    id: q.id,
    kind: q.kind,
    query: q.query,
    expected: q.expected,
    conditions: {},
  }));

  const conditionResults: ConditionResult[] = [];
  for (const { condition, rank, timedRank } of conditions) {
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i] as GoldenQuery;
      const ranked = rank(q);
      (perQuery[i] as PerQueryResult).conditions[condition] = {
        hit5: hitAtK(ranked, q.expected, HIT_K),
        rr10: mrrAtK(ranked, q.expected, MRR_K),
        top10: ranked.slice(0, MRR_K),
      };
    }
    // Latency: `runs` timed executions per query; run 1 per query is cold
    // and discarded, the rest pool into one warm distribution.
    const warm: number[] = [];
    for (const q of queries) {
      for (let r = 0; r < opts.runs; r++) {
        const t0 = performance.now();
        timedRank(q);
        const ms = performance.now() - t0;
        if (r > 0) warm.push(ms);
      }
    }
    conditionResults.push({
      condition,
      metrics: {
        overall: aggregate(perQuery, condition, null),
        semantic: aggregate(perQuery, condition, 'semantic'),
        lexical: aggregate(perQuery, condition, 'lexical'),
        topical: aggregate(perQuery, condition, 'topical'),
      },
      latency: { warm: summarise(warm) },
    });
    log(`${condition}: hit@5 ${conditionResults.at(-1)?.metrics.overall.hit5.toFixed(1)}%`);
  }

  shippedStop?.();
  return {
    snapshotDate: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpus: cpus().length,
    },
    vaultRoot: opts.vaultRoot,
    noteCount: lexical.noteCount,
    querySet: {
      total: queries.length,
      semantic: queries.filter((q) => q.kind === 'semantic').length,
      lexical: queries.filter((q) => q.kind === 'lexical').length,
      topical: queries.filter((q) => q.kind === 'topical').length,
    },
    runs: opts.runs,
    lexicalBuildMs: lexical.buildMs,
    models,
    conditions: conditionResults,
    perQuery,
    gate: computeGate(opts.modelIds, conditionResults),
  };
}

function aggregate(
  perQuery: PerQueryResult[],
  condition: string,
  kind: GoldenKind | null,
): ConditionMetrics {
  const rows = perQuery.filter((p) => kind === null || p.kind === kind);
  if (rows.length === 0) return { hit5: 0, mrr10: 0, n: 0 };
  const results = rows.map((p) => p.conditions[condition] as PerQueryCondition);
  return {
    hit5: (100 * results.filter((r) => r.hit5).length) / results.length,
    mrr10: results.reduce((a, r) => a + r.rr10, 0) / results.length,
    n: rows.length,
  };
}

export function computeGate(modelIds: string[], conditions: ConditionResult[]): GateResult {
  const byName = new Map(conditions.map((c) => [c.condition, c]));
  const lexicalOnly = byName.get('lexical');
  const perModel: ModelGate[] = [];
  for (const modelId of modelIds) {
    const hybrid = byName.get(`hybrid-rrf:${modelId}`);
    const semantic = byName.get(`semantic:${modelId}`);
    if (!lexicalOnly || !hybrid || !semantic) continue;
    const semanticDeltaHit5 = hybrid.metrics.semantic.hit5 - lexicalOnly.metrics.semantic.hit5;
    const lexicalDeltaHit5 = hybrid.metrics.lexical.hit5 - lexicalOnly.metrics.lexical.hit5;
    const semanticWarmP95Ms = semantic.latency.warm.p95;
    const reasons: string[] = [];
    if (semanticDeltaHit5 >= GATE.minSemanticDeltaHit5) {
      reasons.push(`semantic subset hit@5 +${semanticDeltaHit5.toFixed(1)} pts (gate ≥ +10): PASS`);
    } else if (semanticDeltaHit5 >= GATE.discussSemanticDeltaHit5) {
      reasons.push(
        `semantic subset hit@5 +${semanticDeltaHit5.toFixed(1)} pts is in the +5..+10 discuss zone`,
      );
    } else {
      reasons.push(`semantic subset hit@5 ${semanticDeltaHit5.toFixed(1)} pts (gate ≥ +10): FAIL`);
    }
    if (lexicalDeltaHit5 < -GATE.maxLexicalRegressionHit5) {
      reasons.push(
        `lexical subset hit@5 regressed ${lexicalDeltaHit5.toFixed(1)} pts (gate ≥ -2): FAIL`,
      );
    } else {
      reasons.push(`lexical subset hit@5 ${lexicalDeltaHit5.toFixed(1)} pts (gate ≥ -2): PASS`);
    }
    if (semanticWarmP95Ms > GATE.maxSemanticWarmP95Ms) {
      reasons.push(`semantic warm p95 ${semanticWarmP95Ms.toFixed(2)} ms (gate ≤ 15 ms): FAIL`);
    } else {
      reasons.push(`semantic warm p95 ${semanticWarmP95Ms.toFixed(2)} ms (gate ≤ 15 ms): PASS`);
    }
    const hardPass =
      lexicalDeltaHit5 >= -GATE.maxLexicalRegressionHit5 &&
      semanticWarmP95Ms <= GATE.maxSemanticWarmP95Ms;
    const verdict: GateVerdict =
      hardPass && semanticDeltaHit5 >= GATE.minSemanticDeltaHit5
        ? 'ship'
        : hardPass && semanticDeltaHit5 >= GATE.discussSemanticDeltaHit5
          ? 'discuss'
          : 'no-ship';
    perModel.push({
      model: modelId,
      semanticDeltaHit5,
      lexicalDeltaHit5,
      semanticWarmP95Ms,
      verdict,
      reasons,
    });
  }
  const chosen = perModel.find((m) => m.verdict === 'ship');
  const verdict: GateVerdict = chosen
    ? 'ship'
    : perModel.some((m) => m.verdict === 'discuss')
      ? 'discuss'
      : 'no-ship';
  return { perModel, verdict, chosenModel: chosen?.model ?? null };
}
