#!/usr/bin/env node
/**
 * benchmarks.json builder — the single source of truth for every published
 * benchmark number (README, llms.txt, the server README, seekstone.dev).
 *
 * Reads the committed harness baselines under
 * packages/harness/fixtures/baseline-reports/ plus the code-level sources of
 * truth (tool counts, guarantee count, server version — scripts/lib/source-of-truth.mjs)
 * and writes ./benchmarks.json with per-row provenance: which report, its
 * snapshot date, which fixture generation it was captured on, whether the
 * capture was automated or a manual Obsidian session, and the commit that
 * last touched the report.
 *
 * Aggregation mirrors packages/harness/src/bench/scaling.ts — the renderer of
 * benchmark-scaling.md — so the JSON and the markdown can never disagree:
 *   warm latency  = mean over queries of the per-query warm *median*   (scaling.ts:163-168)
 *   payload       = mean over queries of payloadBytesMean              (scaling.ts:170-175)
 *   × seekstone   = adapter / seekstone at 10k, rounded to an integer  (scaling.ts:123)
 *
 * Modes:
 *   (default)  rewrite benchmarks.json in place.
 *   --check    don't write; exit 1 if benchmarks.json is stale (CI guard).
 *              `commit` fields are ignored by the comparison: CI checkouts are
 *              shallow, so `git log -- <path>` would resolve to HEAD there.
 *
 * Consumers: scripts/check-docs-sync.mjs (check 4) verifies README/llms.txt
 * against this file; seekstone.dev vendors a copy and diffs it in its CI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import { readGuaranteeCount, readServerVersion, readToolCounts } from './lib/source-of-truth.mjs';

const root = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');
const OUT = 'benchmarks.json';
const REPORTS = 'packages/harness/fixtures/baseline-reports';

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const r1 = (v) => Number(v.toFixed(1));
const r2 = (v) => Number(v.toFixed(2));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------- fixture generations ----------
// Fixture v2 (SHA-322) regenerated the 10k vault with a real prose link graph;
// every in-process adapter was re-run on it. Snapshots older than this are
// fixture-v1 captures that were never re-run (the REST-proxy rows need a live
// Obsidian session — see packages/harness/README.md, "manual REST capture").
const FIXTURE = { version: 2, issue: 'SHA-322', since: '2026-09-06T00:00:00Z' };
const MANUAL_CAPTURE = new Set(['rest', 'obsidian-mcp-server', 'mcp-obsidian']);

// Stable adapter order (scaling.ts:23-35) + the labels the docs use for each.
const ADAPTERS = [
  ['seekstone', { label: 'Seekstone', architecture: 'in-process index', kind: 'seekstone' }],
  [
    'fs',
    {
      label: 'fs (harness baseline)',
      architecture: 'filesystem-direct baseline',
      kind: 'baseline',
    },
  ],
  ['mcpvault', { label: 'mcpvault', architecture: 'fs-direct subprocess', kind: 'competitor' }],
  [
    'obsidian-mcp-pro',
    { label: 'obsidian-mcp-pro', architecture: 'fs-direct subprocess', kind: 'competitor' },
  ],
  [
    'obsidian-mcp',
    { label: 'obsidian-mcp', architecture: 'fs-direct subprocess', kind: 'competitor' },
  ],
  [
    'obsidian-mcp-rs',
    { label: 'obsidian-mcp-rs', architecture: 'fs-direct, per-query scan', kind: 'competitor' },
  ],
  ['obsidian-tc', { label: 'obsidian-tc', architecture: 'SQLite platform', kind: 'competitor' }],
  ['rest', { label: 'Local REST API (direct)', architecture: 'REST API', kind: 'rest-baseline' }],
  [
    'obsidian-mcp-server',
    { label: 'obsidian-mcp-server', architecture: 'REST API', kind: 'competitor' },
  ],
  ['mcp-obsidian', { label: 'mcp-obsidian', architecture: 'REST API', kind: 'competitor' }],
];
const REST_PROXIES = ['rest', 'obsidian-mcp-server', 'mcp-obsidian'];

// Retrieval conditions the docs cite, with their display labels.
const CONDITION_LABELS = {
  lexical: 'Keyword search (lexical only)',
  'semantic:potion-base-8M': 'Raw semantic scan, 8M model (no rerank)',
  'shipped-hybrid:potion-base-8M': 'Seekstone default (8M + MaxSim, hybrid)',
  'shipped-hybrid:potion-retrieval-32M': 'Seekstone quality mode (opt-in 32M + MaxSim, hybrid)',
  'competitor:obsidian-tc': 'obsidian-tc semantic',
  'competitor:obsidian-tc-graph': 'obsidian-tc GraphRAG',
  'competitor:obsidian-mcp-pro': 'obsidian-mcp-pro',
};
const CONTEXT_WINDOW_TOKENS = 200_000;

// ---------- provenance helpers ----------
const previous = existsSync(join(root, OUT)) ? readJson(OUT) : null;
const previousCommits = new Map();
(function harvest(node) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.report === 'string' && typeof node.commit === 'string') {
    previousCommits.set(node.report, node.commit);
  }
  for (const v of Object.values(node)) harvest(v);
})(previous);

function commitFor(rel) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%h', '--', rel], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out;
  } catch {
    // not a git checkout (or git missing) — fall through
  }
  return previousCommits.get(rel) ?? null;
}

const provenanceFor = (rel, snapshotDate, extra = {}) => ({
  report: rel,
  snapshotDate,
  fixtureVersion: snapshotDate >= FIXTURE.since ? FIXTURE.version : 1,
  ...extra,
  commit: commitFor(rel),
});

// ---------- scaling (payload + latency across 1k / 5k / 10k) ----------
const sizes = readdirSync(join(root, REPORTS, 'scaling'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
  .map((d) => Number(d.name))
  .sort((a, b) => a - b);
if (sizes.length === 0) throw new Error(`no scaling directories under ${REPORTS}/scaling`);
const big = sizes[sizes.length - 1];

const summary = (size, adapter) => {
  const rel = posix.join(REPORTS, 'scaling', String(size), `benchmark-${adapter}.json`);
  return existsSync(join(root, rel)) ? { rel, data: readJson(rel) } : null;
};
// scaling.ts:163-175 — mean of per-query warm medians; mean of per-query payload means.
const meanWarmMs = (s) => mean(s.search.map((q) => q.stats.warm.median).filter((v) => v != null));
const meanPayload = (s) => mean(s.search.map((q) => q.stats.payloadBytesMean).filter((v) => v > 0));
const meanTokens = (s) => mean(s.search.map((q) => q.stats.payloadTokensMean).filter((v) => v > 0));

const adapters = {};
const rawWarm = new Map();
const rawPayload = new Map();
for (const [name, meta] of ADAPTERS) {
  const per = sizes.map((sz) => summary(sz, name));
  if (per.every((p) => p == null)) continue; // adapter not captured at all
  const at = (i, f) => (per[i] ? f(per[i].data) : null);
  const bigIdx = sizes.length - 1;
  const bigData = per[bigIdx]?.data;
  const queries = bigData
    ? bigData.search.map((q) => ({
        id: q.id,
        query: q.query,
        warmMedianMs: r2(q.stats.warm.median),
        payloadBytes: Math.round(q.stats.payloadBytesMean),
        payloadTokens: Math.round(q.stats.payloadTokensMean),
      }))
    : [];
  const worst = queries.reduce(
    (a, q) => (a == null || q.payloadBytes > a.payloadBytes ? q : a),
    null,
  );
  // Unrounded means, kept aside so the multipliers below divide the same raw
  // values scaling.ts divides (rounding first would put 514× off by one).
  rawWarm.set(name, at(bigIdx, meanWarmMs));
  rawPayload.set(name, at(bigIdx, meanPayload));
  adapters[name] = {
    ...meta,
    warmMs: sizes.map((_, i) => at(i, (s) => r1(meanWarmMs(s)))),
    payloadBytes: sizes.map((_, i) => at(i, (s) => Math.round(meanPayload(s)))),
    payloadTokens: sizes.map((_, i) => at(i, (s) => Math.round(meanTokens(s)))),
    vsSeekstone10k: null, // filled below once seekstone's 10k figure is known
    queries10k: queries,
    worst10k: worst
      ? { query: worst.query, bytes: worst.payloadBytes, tokens: worst.payloadTokens }
      : null,
    provenance: per
      .map((p, i) =>
        p
          ? provenanceFor(p.rel, p.data.snapshotDate, {
              size: sizes[i],
              runs: p.data.runs,
              capture: MANUAL_CAPTURE.has(name) ? 'manual' : 'auto',
            })
          : null,
      )
      .filter(Boolean),
  };
}
const seek = adapters.seekstone;
if (!seek) throw new Error('seekstone scaling reports missing');
const seekWarmBig = seek.warmMs[sizes.length - 1];
const seekWarmRaw = rawWarm.get('seekstone');
for (const [name, a] of Object.entries(adapters)) {
  const v = rawWarm.get(name);
  a.vsSeekstone10k =
    v == null ? null : { exact: r1(v / seekWarmRaw), display: Math.round(v / seekWarmRaw) };
}

// ---------- retrieval quality (hit@5, latency, index cost) ----------
const QUIET = posix.join(REPORTS, 'retrieval-eval.json');
const COMPETITORS = posix.join(REPORTS, 'retrieval-eval-competitors.json');
const quiet = readJson(QUIET);
const comp = readJson(COMPETITORS);

const hit = (c, path) => path.reduce((o, k) => o?.[k], c)?.hit5;
const quietByName = new Map(quiet.conditions.map((c) => [c.condition, c]));
const compByName = new Map(comp.conditions.map((c) => [c.condition, c]));

// The two files must agree on quality: latency is read from the quiet run,
// so a divergence in hit@5 would mean they are not the same canon anymore.
for (const [name, q] of quietByName) {
  const c = compByName.get(name);
  if (!c) continue;
  const a = r1(hit(q, ['metrics', 'overall']));
  const b = r1(hit(c, ['metrics', 'overall']));
  if (a !== b) {
    throw new Error(
      `${name}: overall hit@5 differs between retrieval-eval.json (${a}) and retrieval-eval-competitors.json (${b}) — re-baseline both`,
    );
  }
}

const modelIndexMs = (run, modelId) => run.models.find((m) => m.modelId === modelId)?.indexBuildMs;
const modelOf = (name) => name.split(':')[1];

const conditions = {};
const conditionRow = (name, src, extra) => ({
  label: CONDITION_LABELS[name] ?? name,
  overallHit5: r1(hit(src, ['metrics', 'overall'])),
  holdoutHit5: r1(hit(src, ['splits', 'holdout', 'overall'])),
  semanticSubsetHit5: r1(hit(src, ['metrics', 'semantic'])),
  lexicalSubsetHit5: r1(hit(src, ['metrics', 'lexical'])),
  topicalSubsetHit5: r1(hit(src, ['metrics', 'topical'])),
  warmP50Ms: r2(src.latency.warm.median),
  warmP95Ms: r2(src.latency.warm.p95),
  ...extra,
});
// seekstone-side conditions: quality asserted equal above, latency from the quiet run.
for (const q of quiet.conditions) {
  const name = q.condition;
  const model = modelOf(name);
  const shipped = name.startsWith('shipped-');
  conditions[name] = conditionRow(name, q, {
    payloadBytes:
      q.payloadBytesMean != null
        ? Math.round(q.payloadBytesMean)
        : seek.payloadBytes[sizes.length - 1],
    payloadBytesSource: q.payloadBytesMean != null ? 'condition' : 'scaling seekstone @10k',
    ...(shipped && model
      ? {
          indexBuildMs: Math.round(modelIndexMs(comp, model)),
          indexBuildMsQuietRun: Math.round(modelIndexMs(quiet, model)),
        }
      : {}),
    provenance: {
      quality: provenanceFor(COMPETITORS, comp.snapshotDate, { runs: comp.runs }),
      latency: provenanceFor(QUIET, quiet.snapshotDate, { runs: quiet.runs }),
      ...(shipped
        ? {
            index:
              'retrieval-eval-competitors.json#models (same run as the competitor index timings)',
          }
        : {}),
    },
  });
}
// competitor conditions: everything from the head-to-head run.
for (const setup of comp.competitorSetups ?? []) {
  const name = setup.name;
  const c = compByName.get(name);
  const base = {
    label: CONDITION_LABELS[name] ?? name,
    version: setup.version,
    provider: setup.provider,
    indexMs: Math.round(setup.indexMs),
  };
  conditions[name] = c
    ? {
        ...conditionRow(name, c, {}),
        ...base,
        payloadBytes: Math.round(c.payloadBytesMean),
        provenance: provenanceFor(COMPETITORS, comp.snapshotDate, { runs: comp.runs }),
      }
    : {
        ...base,
        failed: true,
        error: setup.indexStats,
        notes: setup.notes,
        provenance: provenanceFor(COMPETITORS, comp.snapshotDate, { runs: comp.runs }),
      };
}

// ---------- headline figures ----------
const bigI = sizes.length - 1;
const competitors = Object.entries(adapters).filter(
  ([, a]) => a.kind === 'competitor' && a.warmMs[bigI] != null,
);
const slowest = competitors.reduce((a, b) => (b[1].warmMs[bigI] > a[1].warmMs[bigI] ? b : a));
const fastest = competitors.reduce((a, b) => (b[1].warmMs[bigI] < a[1].warmMs[bigI] ? b : a));
const largest = Object.entries(adapters).reduce((a, b) =>
  b[1].payloadBytes[bigI] > a[1].payloadBytes[bigI] ? b : a,
);
const contextTaxExact = Math.round(rawPayload.get(largest[0]) / rawPayload.get('seekstone'));
const worstOverall = Object.entries(adapters).reduce((a, b) =>
  (b[1].worst10k?.bytes ?? 0) > (a[1].worst10k?.bytes ?? 0) ? b : a,
);
const restMultipliers = REST_PROXIES.map((n) => adapters[n]?.vsSeekstone10k?.display).filter(
  (v) => v != null,
);
const round10 = (v) => Math.round(v / 10) * 10;
const shippedDefault = conditions['shipped-hybrid:potion-base-8M'];
const rawScan = conditions['semantic:potion-base-8M'];

const headline = {
  warmMs10k: seekWarmBig,
  semanticWarmP50Ms10k: {
    value: shippedDefault.warmP50Ms,
    display: Math.round(shippedDefault.warmP50Ms),
    condition: 'shipped-hybrid:potion-base-8M',
    source: 'retrieval-eval.json (quiet machine)',
  },
  semanticScanP50Ms10k: {
    value: rawScan.warmP50Ms,
    display: Math.round(rawScan.warmP50Ms),
    condition: 'semantic:potion-base-8M',
    source: 'retrieval-eval.json (quiet machine)',
  },
  payloadBytes10k: seek.payloadBytes[bigI],
  payloadTokens10k: seek.payloadTokens[bigI],
  largestMeanPayload10k: { adapter: largest[0], bytes: largest[1].payloadBytes[bigI] },
  contextTax: {
    exact: contextTaxExact,
    display: Math.floor(contextTaxExact / 1000) * 1000,
    rule: 'floor to thousands',
  },
  slowest: {
    adapter: slowest[0],
    warmMs: slowest[1].warmMs[bigI],
    exact: slowest[1].vsSeekstone10k.exact,
    display: slowest[1].vsSeekstone10k.display,
  },
  fastestCompetitor: {
    adapter: fastest[0],
    warmMs: fastest[1].warmMs[bigI],
    exact: fastest[1].vsSeekstone10k.exact,
    display: fastest[1].vsSeekstone10k.display,
  },
  restProxyRange: {
    adapters: REST_PROXIES,
    exact: { min: Math.min(...restMultipliers), max: Math.max(...restMultipliers) },
    display: {
      min: round10(Math.min(...restMultipliers)),
      max: round10(Math.max(...restMultipliers)),
    },
    rule: 'round to tens',
  },
  worstQuery: {
    adapter: worstOverall[0],
    ...worstOverall[1].worst10k,
    vsContextWindow: {
      window: CONTEXT_WINDOW_TOKENS,
      display: Math.round(worstOverall[1].worst10k.tokens / CONTEXT_WINDOW_TOKENS),
    },
  },
};

// ---------- assemble ----------
const seekBig = summary(big, 'seekstone').data;
const doc = {
  schemaVersion: 1,
  generatedBy: 'scripts/build-benchmarks-json.mjs',
  fixture: {
    version: FIXTURE.version,
    issue: FIXTURE.issue,
    noteCount: quiet.noteCount,
    vault: 'packages/harness/fixtures/vault',
    commit: commitFor('packages/harness/fixtures/vault'),
    machine: seekBig.machine,
  },
  release: { version: readServerVersion(root), source: 'packages/server/package.json#version' },
  tools: {
    ...readToolCounts(root),
    source: 'packages/server/src/dispatch.ts#HANDLED_TOOLS,WRITE_TOOLS',
  },
  guarantees: { count: readGuaranteeCount(root), source: 'docs/WRITE-SAFETY.md "### N." headings' },
  scaling: {
    sizes,
    runs: seekBig.runs,
    queries: seekBig.search.length,
    method:
      'warmMs = mean over queries of per-query warm median; payload = mean over queries of payloadBytesMean (packages/harness/src/bench/scaling.ts)',
    adapters,
  },
  headline,
  retrieval: {
    querySet: {
      total: quiet.querySet.total,
      semantic: quiet.querySet.semantic,
      lexical: quiet.querySet.lexical,
      topical: quiet.querySet.topical,
      dev: quiet.querySet.splits.dev.total,
      holdout: quiet.querySet.splits.holdout.total,
    },
    latencyRule:
      'seekstone rows: hit@5 asserted equal across both runs, warm latency from retrieval-eval.json (quiet machine); competitor rows, index timings and gateV2 from retrieval-eval-competitors.json (the head-to-head run)',
    conditions,
    gateV2: {
      ...comp.gateV2,
      preRegistered: 'SHA-311',
      ranOn: 'SHA-316 (fixture v1, 2026-08-31)',
      recomputedOnV2: true,
      note: 'No pre-registered gate ran on fixture v2; these are the SHA-316 clauses recomputed on the v2 canon (COMPETITORS-SHA-322.md).',
    },
  },
};

// ---------- write / check ----------
const next = `${JSON.stringify(doc, null, 2)}\n`;
const raw = existsSync(join(root, OUT)) ? readFileSync(join(root, OUT), 'utf8') : '';
const stripCommits = (node) => {
  if (Array.isArray(node)) return node.map(stripCommits);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) if (k !== 'commit') out[k] = stripCommits(v);
    return out;
  }
  return node;
};
const same =
  raw !== '' && JSON.stringify(stripCommits(JSON.parse(raw))) === JSON.stringify(stripCommits(doc));

if (same) {
  console.log(
    `${OUT} already in sync (fixture v${FIXTURE.version}, release ${doc.release.version}).`,
  );
  process.exit(0);
}
if (check) {
  console.error(
    `${OUT} is stale relative to the committed baseline reports / code sources of truth.\n` +
      'Run `node scripts/build-benchmarks-json.mjs` and commit the result.',
  );
  process.exit(1);
}
writeFileSync(join(root, OUT), next);
console.log(`${OUT} written (fixture v${FIXTURE.version}, release ${doc.release.version}).`);
