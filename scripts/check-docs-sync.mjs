#!/usr/bin/env node
/**
 * Docs-sync guard — fails CI when documentation drifts from the code.
 *
 * Three checks, all derived from source-of-truth code, never from other docs:
 *
 *  1. Tool counts. Every "<N> tools" phrase in the marketing/doc surfaces must
 *     equal HANDLED_TOOLS.length in dispatch.ts, and every "<N> read/write
 *     tools" split must match the WRITE_TOOLS partition.
 *  2. Retired claims. Numbers the messaging doc has retired (575×, the old
 *     1.75 MB / 459k-token measurement, ~800×) must not appear in any current
 *     doc surface. CHANGELOGs and .changeset are exempt (they record history).
 *  3. Env vars. Every SEEKSTONE_* variable the server reads must be documented
 *     in both READMEs' configuration tables.
 *
 * Born from the 2026-08 audit that found the npm README shipping a claim
 * retired a month earlier (SHA-276) plus "16 tools" surviving in
 * ARCHITECTURE.md — every one of those would have been caught here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];

// ---------- source of truth: dispatch.ts ----------
const dispatch = read('packages/server/src/dispatch.ts');
const handled = dispatch.match(/HANDLED_TOOLS = \[([\s\S]*?)\]/);
if (!handled) throw new Error('cannot locate HANDLED_TOOLS in dispatch.ts');
const toolCount = [...handled[1].matchAll(/'[^']+'/g)].length;
const writeTools = dispatch.match(/WRITE_TOOLS[^=]*= new Set\(\[([\s\S]*?)\]\)/);
if (!writeTools) throw new Error('cannot locate WRITE_TOOLS in dispatch.ts');
const writeCount = [...writeTools[1].matchAll(/'[^']+'/g)].length;
const readCount = toolCount - writeCount;

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

// ---------- verdict ----------
if (errors.length > 0) {
  console.error(`docs-sync guard: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(
  `docs-sync guard: ${COUNT_SURFACES.length + RETIRED_SURFACES.length} surfaces clean ` +
    `(${toolCount} tools = ${readCount} read + ${writeCount} write; ${vars.size} env vars documented)`,
);
