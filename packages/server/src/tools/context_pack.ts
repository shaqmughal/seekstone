import { extractLinksWithLines } from '@seekstone/core/extract';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { extractExcerpt } from '../index/excerpt.js';
import { resolveLink } from '../index/resolve.js';
import { basenameNoExt } from './search.js';

export const ContextPackInput = z.object({
  query: z.string().min(1).describe('Natural-language question or topic to assemble context for.'),
  budgetBytes: z
    .number()
    .int()
    .min(256)
    .max(16384)
    .default(2048)
    .describe('Hard cap on the response JSON size in bytes. The pack never exceeds it.'),
});
export type ContextPackInput = z.infer<typeof ContextPackInput>;

const MAX_CANDIDATES = 10;
const NEIGHBOR_HITS = 3;
const MAX_NEIGHBORS = 5;
const NEIGHBOR_SUMMARY_LEN = 100;
const MIN_EXCERPT_LEN = 60;
const FM_MAX_BYTES = 120;
const SOURCES_MAX = 8;

export interface ContextPackExcerpt {
  path: string;
  title?: string;
  score: number;
  excerpt: string;
  tags?: string[];
  /** Scalar frontmatter values, in key order, capped at FM_MAX_BYTES serialized. */
  fm?: Record<string, unknown>;
}

export interface ContextPackNeighbor {
  path: string;
  rel: 'backlink' | 'outlink' | 'both';
  /** Line in the neighbor where it links to a hit (backlinks only). */
  line?: number;
  summary: string;
}

export interface ContextPackSource {
  path: string;
  line?: number;
}

export interface ContextPackResult {
  excerpts: ContextPackExcerpt[];
  neighborhood: ContextPackNeighbor[];
  /** Overflow refs only — matches and neighbors that did not fit the budget. */
  sources: ContextPackSource[];
  totalMatches: number;
  confidence: 'high' | 'low' | 'none';
  truncated?: true;
}

/** Serialized cost of one array entry, +1 for the separating comma (conservative). */
function entryCost(entry: unknown): number {
  return Buffer.byteLength(JSON.stringify(entry), 'utf8') + 1;
}

/** Pick scalar frontmatter values in key order until the serialized subset exceeds the cap. */
function pickFm(fm: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!fm) return undefined;
  const out: Record<string, unknown> = {};
  let picked = 0;
  for (const key of Object.keys(fm)) {
    const v = fm[key];
    const t = typeof v;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') continue;
    const candidate = { ...out, [key]: v };
    if (Buffer.byteLength(JSON.stringify(candidate), 'utf8') > FM_MAX_BYTES) break;
    out[key] = v;
    picked += 1;
  }
  return picked > 0 ? out : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function contextPack(ctx: ServerContext, input: ContextPackInput): ContextPackResult {
  const results = ctx.index.search(input.query, {
    boost: { title: 3, tags: 2, body: 1 },
    fuzzy: 0.2,
    prefix: true,
  });
  const totalMatches = results.length;
  if (totalMatches === 0) {
    return { excerpts: [], neighborhood: [], sources: [], totalMatches: 0, confidence: 'none' };
  }

  const terms = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const scoreByPath = new Map<string, number>();
  for (const r of results) scoreByPath.set(r.id, r.score);

  // Meter the fixed envelope with worst-case flags so emitting them later can
  // never break the cap. Entries are metered against the same minified
  // serialization dispatch ships, so the budget is exact, not an estimate.
  const budget = input.budgetBytes;
  let used = Buffer.byteLength(
    JSON.stringify({
      excerpts: [],
      neighborhood: [],
      sources: [],
      totalMatches,
      confidence: 'high',
      truncated: true,
    }),
    'utf8',
  );

  // Phase 1 — excerpts: greedy fill in rank order, holding back a soft reserve
  // for the neighborhood. On the first non-fit, shrink the excerpt (half, then
  // the floor); a shrunk entry ends the phase so the pack isn't all fragments.
  const excerptLen = clamp(Math.floor(budget / 10), 80, 400);
  const reserve = Math.min(Math.floor(budget / 4), 600);
  const candidates = results.slice(0, MAX_CANDIDATES);
  const excerpts: ContextPackExcerpt[] = [];
  const overflowHits: ContextPackSource[] = [];
  let droppedForBudget = false;

  const buildEntry = (r: (typeof results)[number], len: number): ContextPackExcerpt => {
    const note = ctx.notes.get(r.id);
    const body = note?.body ?? '';
    const noteTags = note?.tags ? note.tags.split(' ').filter(Boolean) : [];
    const entry: ContextPackExcerpt = {
      path: r.id,
      score: Math.round(r.score * 100) / 100,
      excerpt: extractExcerpt(body, terms, len),
    };
    const title = r.title as string;
    if (title && title !== basenameNoExt(r.id)) entry.title = title;
    if (noteTags.length > 0) entry.tags = noteTags;
    const fm = pickFm(note?.fm ?? null);
    if (fm) entry.fm = fm;
    return entry;
  };

  const excerptCap = budget - reserve;
  let phaseOpen = true;
  for (const r of candidates) {
    if (!phaseOpen) {
      overflowHits.push({ path: r.id });
      continue;
    }
    let placed = false;
    const shrinkLens = [
      ...new Set([
        excerptLen,
        Math.max(Math.floor(excerptLen / 2), MIN_EXCERPT_LEN),
        MIN_EXCERPT_LEN,
      ]),
    ];
    for (const len of shrinkLens) {
      const entry = buildEntry(r, len);
      const cost = entryCost(entry);
      if (used + cost <= excerptCap) {
        excerpts.push(entry);
        used += cost;
        placed = true;
        // A shrunk excerpt means the budget is nearly spent — stop before
        // packing many useless fragments.
        if (len !== excerptLen) phaseOpen = false;
        break;
      }
    }
    if (!placed) {
      phaseOpen = false;
      droppedForBudget = true;
      overflowHits.push({ path: r.id });
    }
  }

  // Phase 2 — neighborhood: backlinks + outlinks of the top included hits.
  // The reserve is released; entries fill whatever budget remains.
  const includedPaths = new Set(excerpts.map((e) => e.path));
  const seeds = excerpts.slice(0, NEIGHBOR_HITS).map((e) => e.path);
  const agg = new Map<
    string,
    { rels: Set<'backlink' | 'outlink'>; seedPaths: Set<string>; line?: number }
  >();
  const connect = (
    neighborPath: string,
    seed: string,
    rel: 'backlink' | 'outlink',
    line?: number,
  ) => {
    if (neighborPath === seed || includedPaths.has(neighborPath)) return; // excerpt wins dedup
    if (!ctx.notes.has(neighborPath)) return;
    let entry = agg.get(neighborPath);
    if (!entry) {
      entry = { rels: new Set(), seedPaths: new Set() };
      agg.set(neighborPath, entry);
    }
    entry.rels.add(rel);
    entry.seedPaths.add(seed);
    if (rel === 'backlink' && entry.line === undefined && line !== undefined) entry.line = line;
  };
  for (const seed of seeds) {
    for (const ref of ctx.backlinks.get(seed) ?? []) {
      connect(ref.path, seed, 'backlink', ref.line);
    }
    const note = ctx.notes.get(seed);
    if (!note) continue;
    for (const link of extractLinksWithLines(note.raw)) {
      const target = resolveLink(link.target, ctx.notes);
      if (target !== undefined) connect(target, seed, 'outlink');
    }
  }

  const ranked = [...agg.entries()].sort((a, b) => {
    const conn = b[1].seedPaths.size - a[1].seedPaths.size;
    if (conn !== 0) return conn;
    const score = (scoreByPath.get(b[0]) ?? 0) - (scoreByPath.get(a[0]) ?? 0);
    if (score !== 0) return score;
    return a[0] < b[0] ? -1 : 1;
  });

  const neighborhood: ContextPackNeighbor[] = [];
  const overflowNeighbors: ContextPackSource[] = [];
  for (const [path, info] of ranked) {
    if (neighborhood.length >= MAX_NEIGHBORS) {
      overflowNeighbors.push(info.line !== undefined ? { path, line: info.line } : { path });
      continue;
    }
    const note = ctx.notes.get(path);
    const entry: ContextPackNeighbor = {
      path,
      rel: info.rels.size === 2 ? 'both' : info.rels.has('backlink') ? 'backlink' : 'outlink',
      summary: extractExcerpt(note?.body ?? '', terms, NEIGHBOR_SUMMARY_LEN),
    };
    if (info.line !== undefined) entry.line = info.line;
    const cost = entryCost(entry);
    if (used + cost > budget) {
      droppedForBudget = true;
      overflowNeighbors.push(info.line !== undefined ? { path, line: info.line } : { path });
      // First non-fit ends the phase — later entries rank lower anyway.
      for (const [p, i] of ranked.slice(ranked.findIndex(([rp]) => rp === path) + 1)) {
        overflowNeighbors.push(i.line !== undefined ? { path: p, line: i.line } : { path: p });
      }
      break;
    }
    neighborhood.push(entry);
    used += cost;
  }

  // Phase 3 — sources: overflow refs ("read these next"), deduped, best-first.
  const sources: ContextPackSource[] = [];
  const sourcePaths = new Set<string>();
  for (const ref of [...overflowHits, ...overflowNeighbors]) {
    if (sources.length >= SOURCES_MAX) break;
    if (includedPaths.has(ref.path) || sourcePaths.has(ref.path)) continue;
    const cost = entryCost(ref);
    if (used + cost > budget) break;
    sources.push(ref);
    sourcePaths.add(ref.path);
    used += cost;
  }

  const hasTermInExcerpt = excerpts.some((e) =>
    terms.some((t) => e.excerpt.toLowerCase().includes(t)),
  );
  const confidence: ContextPackResult['confidence'] =
    excerpts.length === 0 || (terms.length > 0 && !hasTermInExcerpt) ? 'low' : 'high';

  const result: ContextPackResult = { excerpts, neighborhood, sources, totalMatches, confidence };
  if (droppedForBudget) result.truncated = true;
  return result;
}
