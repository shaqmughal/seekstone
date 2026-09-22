// A/B: time the server's lexical `search` over the golden queries, in-process.
import { readFileSync } from 'node:fs';
import { buildIndex } from './packages/server/src/index/build.js';
import { PERMISSIVE_POLICY } from './packages/server/src/policy.js';
import { search } from './packages/server/src/tools/search.js';
const vault = `${process.cwd()}/packages/harness/fixtures/vault`;
const golden = JSON.parse(readFileSync(`${process.cwd()}/packages/harness/queries/golden.json`, 'utf8'));
const queries: string[] = golden.queries.map((q: { query: string }) => q.query);
const { index, notes, backlinks } = await buildIndex(vault);
const ctx = { vaultRoot: vault, index, notes, backlinks, policy: PERMISSIVE_POLICY };
for (const q of queries) await search(ctx, { query: q, limit: 50 }); // warm
const samples: number[] = [];
for (let run = 0; run < 20; run++) for (const q of queries) { const t = performance.now(); await search(ctx, { query: q, limit: 50 }); samples.push(performance.now() - t); }
samples.sort((a, b) => a - b);
const p = (x: number) => samples[Math.floor(samples.length * x)]!.toFixed(2);
console.log(`${process.env.LABEL}: n=${samples.length} median=${p(0.5)} p90=${p(0.9)} p95=${p(0.95)}`);
