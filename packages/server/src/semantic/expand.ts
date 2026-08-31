/**
 * SHA-315: 1-hop graph expansion of the semantic candidate list.
 *
 * ⚠️ NOT wired into the shipped search pipeline. The dev-split eval could
 * not measure a gain on the committed fixture because the fixture's links
 * are RANDOM by design (golden-set rule) — gated expansion was
 * metric-identical to the SHA-314 baseline and the gate-disabled control
 * was strictly worse, exactly as a signal-free graph predicts. Verdict:
 * fixtures/baseline-reports/EXPANSION-SHA-315.md. The module stays because
 * the harness eval exercises it (`--experiments` xp-* conditions) and it is
 * the implementation to re-tune once the fixture generator emits real
 * prose cross-links.
 *
 * Design (validated by unit tests, awaiting a fixture that can measure it):
 * tc-graph's best condition expands vector seeds through the wikilink graph
 * and pays seconds per query re-walking it. The server already holds that
 * graph warm (ctx.backlinks + per-note outbound links), so the same
 * expansion costs link lookups plus a few hundred dot products. Each top
 * seed contributes its 1-hop neighbors — outbound links AND backlinks;
 * never multi-hop, that's tc's latency trap. A neighbor survives only if
 * its OWN pooled chunk score against the query clears `minGate` (chunk
 * vectors are already in the SemanticStore), and each seed keeps at most
 * `capPerSeed` survivors by that gate score — the two guards that keep hub
 * notes from flooding the candidate list. Survivors score
 * `seedScore × hopDecay` (best contributing seed) and fuse with the
 * original list:
 *
 * - `boost`: merge by path, keep the max score — a strong graph signal can
 *   lift a tail candidate or introduce a new note, seeds never move down.
 * - `rrf`: reciprocal-rank fusion of the original ranking with the
 *   expansion ranking (k = 60, matching the harness's rrfFuse).
 */
import { extractLinksWithLines } from '@seekstone/core/extract';
import { resolveLink } from '../index/resolve.js';
import type { SemanticHit } from './store.js';

/** Seeds expanded (top of the reranked candidate list). Dev-split tuned. */
export const EXPAND_SEEDS = 10;
/** Score multiplier per hop. Dev-split tuned. */
export const EXPAND_HOP_DECAY = 0.6;
/** Max surviving neighbors per seed, by gate score. Dev-split tuned. */
export const EXPAND_CAP = 5;
/** Min pooled cosine of a neighbor against the query. Dev-split tuned. */
export const EXPAND_MIN_GATE = 0.3;

export type ExpandFusion = 'boost' | 'rrf';

export interface ExpandOptions {
  seeds?: number;
  hopDecay?: number;
  capPerSeed?: number;
  minGate?: number;
  fusion?: ExpandFusion;
}

/** RRF damping constant (Cormack et al.), matching the harness. */
const RRF_K = 60;

/**
 * Expand `hits` (rank order, scores on whatever scale the caller fused in —
 * expansion only multiplies and compares within it) through the link graph.
 *
 * `neighbors` returns a seed's 1-hop notes, both directions, resolved to
 * vault-relative paths (duplicates and the seed itself are tolerated).
 * `scoreNote` scores one note's cached chunk vectors against the query and
 * returns its best chunk for excerpts; `undefined` (no vectors — e.g. a note
 * inside the re-embed debounce window) drops the neighbor, like the rerank.
 *
 * Returns a new re-sorted array, possibly longer than the input; the caller
 * cuts to its limit. Input hits are not mutated.
 */
export function expandHits(
  hits: ReadonlyArray<SemanticHit>,
  neighbors: (path: string) => Iterable<string>,
  scoreNote: (path: string) => SemanticHit | undefined,
  opts: ExpandOptions = {},
): SemanticHit[] {
  const seeds = opts.seeds ?? EXPAND_SEEDS;
  const hopDecay = opts.hopDecay ?? EXPAND_HOP_DECAY;
  const capPerSeed = opts.capPerSeed ?? EXPAND_CAP;
  const minGate = opts.minGate ?? EXPAND_MIN_GATE;
  const fusion = opts.fusion ?? 'boost';
  if (hits.length === 0 || seeds <= 0 || capPerSeed <= 0 || hopDecay <= 0) return [...hits];

  // path → best expansion entry across seeds (max expansion score wins).
  // A neighbor that is itself a seed is still boostable — mutual links among
  // the top candidates are the strongest topical signal there is; max-merge
  // guarantees the boost can only lift it, never demote.
  const expansions = new Map<string, { score: number; gate: SemanticHit }>();
  for (const seed of hits.slice(0, seeds)) {
    const gated: Array<{ gate: SemanticHit; score: number }> = [];
    const seen = new Set<string>();
    for (const path of neighbors(seed.path)) {
      if (path === seed.path || seen.has(path)) continue;
      seen.add(path);
      const gate = scoreNote(path);
      if (gate === undefined || gate.score < minGate) continue;
      gated.push({ gate, score: seed.score * hopDecay });
    }
    // Per-seed cap: keep the top capPerSeed neighbors by the neighbor's own
    // gate score (not the seed-derived score, which is constant per seed).
    gated.sort((a, b) => b.gate.score - a.gate.score || (a.gate.path < b.gate.path ? -1 : 1));
    for (const entry of gated.slice(0, capPerSeed)) {
      const prev = expansions.get(entry.gate.path);
      if (!prev || entry.score > prev.score) {
        expansions.set(entry.gate.path, { score: entry.score, gate: entry.gate });
      }
    }
  }
  if (expansions.size === 0) return [...hits];

  return fusion === 'rrf' ? rrfMerge(hits, expansions) : boostMerge(hits, expansions);
}

/**
 * 1-hop neighbor lookup over the warm indexes: outbound wikilinks derived
 * from the note's raw text (same extraction + loose resolution as get_links)
 * unioned with the backlink index. Memoized per closure — create one per
 * query (the server) or per eval (the harness's static fixture); never hold
 * one across watcher updates.
 *
 * Structural parameters (not ServerContext) so the harness can feed its own
 * context and tests can feed plain maps.
 */
export function neighborsFor(
  notes: Map<string, { raw: string }>,
  backlinks: Map<string, ReadonlyArray<{ path: string }>>,
): (path: string) => string[] {
  const memo = new Map<string, string[]>();
  return (path) => {
    const cached = memo.get(path);
    if (cached) return cached;
    const out = new Set<string>();
    const note = notes.get(path);
    if (note) {
      for (const link of extractLinksWithLines(note.raw)) {
        const resolved = resolveLink(link.target, notes);
        if (resolved !== undefined) out.add(resolved);
      }
    }
    for (const ref of backlinks.get(path) ?? []) out.add(ref.path);
    const arr = [...out];
    memo.set(path, arr);
    return arr;
  };
}

/**
 * Merge by path keeping the max score. An existing hit keeps its own chunk
 * span (already the best chunk vs the query); a new note takes the gate
 * hit's span.
 */
function boostMerge(
  hits: ReadonlyArray<SemanticHit>,
  expansions: Map<string, { score: number; gate: SemanticHit }>,
): SemanticHit[] {
  const merged: SemanticHit[] = hits.map((h) => {
    const exp = expansions.get(h.path);
    return exp && exp.score > h.score ? { ...h, score: exp.score } : { ...h };
  });
  const present = new Set(hits.map((h) => h.path));
  for (const [path, { score, gate }] of expansions) {
    if (!present.has(path)) merged.push({ ...gate, path, score });
  }
  return sortHits(merged);
}

/**
 * Reciprocal-rank fusion of the original ranking with the expansion ranking
 * (expansion entries ordered by expansion score). RRF scores replace the
 * input scores — only relative order is meaningful downstream.
 */
function rrfMerge(
  hits: ReadonlyArray<SemanticHit>,
  expansions: Map<string, { score: number; gate: SemanticHit }>,
): SemanticHit[] {
  const scores = new Map<string, number>();
  const rank = (paths: string[]) => {
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i] as string;
      scores.set(p, (scores.get(p) ?? 0) + 1 / (RRF_K + i + 1));
    }
  };
  rank(hits.map((h) => h.path));
  rank(
    [...expansions.entries()]
      .sort((a, b) => b[1].score - a[1].score || (a[0] < b[0] ? -1 : 1))
      .map(([path]) => path),
  );
  const byPath = new Map(hits.map((h) => [h.path, h]));
  return sortHits(
    [...scores.entries()].map(([path, score]) => {
      const base = byPath.get(path) ?? (expansions.get(path) as { gate: SemanticHit }).gate;
      return { ...base, path, score };
    }),
  );
}

function sortHits(hits: SemanticHit[]): SemanticHit[] {
  return hits.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
