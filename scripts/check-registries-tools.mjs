#!/usr/bin/env node
// Guard: the tool count/list in docs/REGISTRIES.md must match the server's
// actual tool surface. That file is the *canonical copy* people paste into every
// registry/directory listing (Glama, mcp.so, awesome-* PRs), so a stale count
// there propagates everywhere. It drifted to "8 tools" while the server grew to
// 16 — this check stops that from happening again.
//
// Source of truth: HANDLED_TOOLS in packages/server/src/dispatch.ts.
//
// Mirrors scripts/sync-server-json.mjs --check (the server.json version guard).
// Check-only: REGISTRIES.md interleaves prose with a hand-formatted Read/Write
// split, so this fails CI on drift rather than rewriting the file.

import { readFileSync } from 'node:fs';

const repoRoot = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${repoRoot}${p}`, 'utf8');

// --- source of truth: HANDLED_TOOLS ---
const dispatch = read('packages/server/src/dispatch.ts');
const block = dispatch.match(/export const HANDLED_TOOLS = \[([\s\S]*?)\] as const;/);
if (!block) {
  console.error(
    'check-registries-tools: could not find HANDLED_TOOLS in packages/server/src/dispatch.ts.',
  );
  process.exit(1);
}
const tools = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const toolSet = new Set(tools);
const count = tools.length;

// --- doc under guard ---
const doc = read('docs/REGISTRIES.md');
const errors = [];

// 1. Description prose: "<N> tools over stdio".
const prose = doc.match(/(\d+) tools over stdio/);
if (!prose) {
  errors.push('Description is missing the "<N> tools over stdio" count.');
} else if (Number(prose[1]) !== count) {
  errors.push(`Description says "${prose[1]} tools over stdio" but HANDLED_TOOLS has ${count}.`);
}

// 2. Canonical-copy heading: "**Tools (<N>):**".
const head = doc.match(/\*\*Tools \((\d+)\):\*\*([^\n]*)/);
if (!head) {
  errors.push('Canonical copy is missing the "**Tools (<N>):**" line.');
} else {
  if (Number(head[1]) !== count) {
    errors.push(`Tools line says "(${head[1]})" but HANDLED_TOOLS has ${count}.`);
  }
  // 3. Every tool is listed, and no stale tool lingers. A tool-name token is a
  //    snake_case identifier, plus the lone single-word tool `search`.
  const listed = new Set(
    [...head[2].matchAll(/\b([a-z][a-z]*_[a-z_]+|search)\b/g)].map((m) => m[1]),
  );
  for (const tool of tools) {
    if (!listed.has(tool)) errors.push(`Tools line is missing "${tool}".`);
  }
  for (const tool of listed) {
    if (!toolSet.has(tool)) {
      errors.push(`Tools line lists "${tool}", which is not in HANDLED_TOOLS (stale?).`);
    }
  }
}

if (errors.length > 0) {
  console.error('docs/REGISTRIES.md is out of sync with the server tool list:');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    `\nThe server exposes ${count} tools: ${tools.join(', ')}.\n` +
      'Update docs/REGISTRIES.md (count + Tools line) to match HANDLED_TOOLS.',
  );
  process.exit(1);
}

console.log(`docs/REGISTRIES.md tool count/list in sync (${count} tools).`);
