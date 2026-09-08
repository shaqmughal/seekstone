#!/usr/bin/env node
/**
 * Docs-sync guard — fails CI when documentation drifts from the code.
 *
 * Four checks, all derived from source-of-truth artifacts, never from other docs:
 *
 *  1. Tool counts. Every "<N> tools" phrase in the marketing/doc surfaces must
 *     equal HANDLED_TOOLS.length in dispatch.ts, and every "<N> read/write
 *     tools" split must match the WRITE_TOOLS partition.
 *  2. Retired claims. Numbers the messaging doc has retired (575×, the old
 *     1.75 MB / 459k-token measurement, ~800×) must not appear in any current
 *     doc surface. CHANGELOGs and .changeset are exempt (they record history).
 *  3. Env vars. Every SEEKSTONE_* variable the server reads must be documented
 *     in both READMEs' configuration tables.
 *  4. Benchmark figures. Every headline number in README / llms.txt / the npm
 *     surfaces must equal the committed benchmarks.json (itself generated from
 *     the harness baselines by scripts/build-benchmarks-json.mjs, and kept in
 *     sync by its own --check step). Anchored sentences — a reworded claim
 *     fails loudly instead of slipping out from under the guard. Logic lives
 *     in scripts/benchmarks-guard.mjs so it is unit-tested.
 *
 * Born from the 2026-08 audit that found the npm README shipping a claim
 * retired a month earlier (SHA-276) plus "16 tools" surviving in
 * ARCHITECTURE.md — every one of those would have been caught here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { checkNumbers, figureCount } from './benchmarks-guard.mjs';
import { readGuaranteeCount, readToolCounts } from './lib/source-of-truth.mjs';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];

// ---------- source of truth: dispatch.ts ----------
const { total: toolCount, read: readCount, write: writeCount } = readToolCounts(root);

// ---------- check 1: tool counts ----------
const COUNT_SURFACES = [
  'README.md',
  'packages/server/README.md',
  'packages/harness/README.md',
  'packages/server/package.json',
  'llms.txt',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
  // Every docs/*.md — a hand-maintained list left docs/WRITE-SAFETY.md
  // unguarded, which is exactly the file that went stale before.
  ...readdirSync(join(root, 'docs'))
    .filter((f) => f.endsWith('.md') && statSync(join(root, 'docs', f)).isFile())
    .map((f) => `docs/${f}`),
];
for (const file of COUNT_SURFACES) {
  const text = read(file);
  for (const m of text.matchAll(/(\d+) {1,2}(?:tools|read tools|write tools)/g)) {
    const n = Number(m[1]);
    const kind = m[0].includes('read')
      ? { expect: readCount, label: 'read tools' }
      : m[0].includes('write')
        ? { expect: writeCount, label: 'write tools' }
        : { expect: toolCount, label: 'tools' };
    if (n !== kind.expect) {
      const line = text.slice(0, m.index).split('\n').length;
      errors.push(`${file}:${line} says "${m[0]}" but the server has ${kind.expect} ${kind.label}`);
    }
  }
}

// ---------- check 2: retired claims ----------
const RETIRED = [
  /575\s*[×x]/,
  /1\.75\s*MB/,
  /459,?000/,
  /~?800×/,
  /compare-and-swap (on )?edits/,
  // Reversed word order of the same retired scoping ("edits support … CAS").
  /\bedits? support\b[^.\n]{0,80}compare-and-swap/,
  // SHA-316: pre-MaxSim comparison numbers, superseded by the gate-v2 matrix
  // (retrieval-eval-competitors + GATE-V2-SHA-316). Our old 76% overall and
  // the old tc latency/index measurements must not resurface.
  /vs our 76%/,
  /171\s*ms vs 14\s*ms/,
  /26\.5[- ]minute/,
  // SHA-327: the fixture-v1 canon, retired by the fixture-v2 re-baseline
  // (SHA-322). Our old 6.2 ms / 440× / ~14 ms headline, the v1 retrieval
  // figures, and the "beats tc's plain semantic on holdout" claim that v2
  // overturned (tc holds 90.0% vs our 86.7%). Live numbers are checked
  // against benchmarks.json in check 4; this list is the belt to that braces.
  /6\.2\s*ms/,
  /~?440×/,
  /~?118×/,
  /\b2,?714\b/,
  /\b1,?302\b/,
  /\b958\s*ms/,
  /~14\s*ms/,
  /~6× slower/,
  /~?90–250×/,
  /91\.7% (on the )?held-out/,
  /vs our 91\.7%/,
  /84\.0% overall/,
  /85\.0% (held|hold)/,
  /222\s*ms/,
  /833\s*ms/,
  /36-minute/,
  /~23 minutes/,
  /88% of the time/,
  /beats obsidian-tc'?s plain/,
];
const RETIRED_SURFACES = [
  'README.md',
  'packages/server/README.md',
  'packages/harness/README.md',
  'packages/server/package.json',
  'packages/server/manifest.json',
  'llms.txt',
  'SECURITY.md',
  'CLAUDE.md',
  ...readdirSync(join(root, 'docs'))
    .filter((f) => f.endsWith('.md') && statSync(join(root, 'docs', f)).isFile())
    .map((f) => `docs/${f}`),
];
for (const file of RETIRED_SURFACES) {
  const text = read(file);
  for (const re of RETIRED) {
    const m = text.match(re);
    if (m) {
      const line = text.slice(0, m.index).split('\n').length;
      errors.push(`${file}:${line} contains retired claim "${m[0]}" — see the messaging doc`);
    }
  }
}

// ---------- check 3: env vars documented ----------
const serverSrc = join(root, 'packages/server/src');
const vars = new Set();
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/env(?:\.|\[['"])(SEEKSTONE_[A-Z_]+)/g)) {
        vars.add(m[1]);
      }
    }
  }
};
walk(serverSrc);
for (const file of [
  'README.md',
  'packages/server/README.md',
  // CLAUDE.md deliberately points at the README's Configuration table instead of
  // duplicating the env-var list (trimmed in SHA-321); counts + retired-claims
  // checks above still cover it.
  'docs/ARCHITECTURE.md',
]) {
  const text = read(file);
  for (const v of vars) {
    if (!text.includes(v)) errors.push(`${file} is missing env var ${v} from its config table`);
  }
}

// ---------- check 4: benchmark figures match benchmarks.json ----------
const bench = JSON.parse(read('benchmarks.json'));
if (bench.tools.total !== toolCount || bench.tools.write !== writeCount) {
  errors.push(
    `benchmarks.json says ${bench.tools.total} tools (${bench.tools.write} write) but dispatch.ts has ${toolCount} (${writeCount} write) — run node scripts/build-benchmarks-json.mjs`,
  );
}
const guaranteeCount = readGuaranteeCount(root);
if (bench.guarantees.count !== guaranteeCount) {
  errors.push(
    `benchmarks.json says ${bench.guarantees.count} guarantees but docs/WRITE-SAFETY.md has ${guaranteeCount} — run node scripts/build-benchmarks-json.mjs`,
  );
}
errors.push(...checkNumbers(bench, read));

// ---------- verdict ----------
if (errors.length > 0) {
  console.error(`docs-sync guard: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(
  `docs-sync guard: ${COUNT_SURFACES.length + RETIRED_SURFACES.length} surfaces clean ` +
    `(${toolCount} tools = ${readCount} read + ${writeCount} write; ${vars.size} env vars documented; ` +
    `${figureCount(bench)} benchmark figures verified against benchmarks.json)`,
);
