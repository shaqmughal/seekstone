#!/usr/bin/env node
// Protocol-conformance gate: boot the built server over stdio with a scratch
// vault and drive it with the MCP SDK reference client — the same client code
// every TypeScript MCP client embeds. If this passes, any spec-compliant
// client (Claude Desktop/Code, Cursor, VS Code, Windsurf, …) can talk to us;
// per-client differences are config-file plumbing, tested elsewhere.
//
// Asserts:
//   1. initialize handshake succeeds and identifies as `seekstone`
//   2. tools/list matches HANDLED_TOOLS exactly (no drops, no strays)
//   3. tools/call round-trips: `search` finds seeded content, `append_note`
//      writes it to disk with the frontmatter byte-identical
//
// Requires `npm run build -w seekstone` first (CI builds before this runs).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repoRoot = new URL('..', import.meta.url).pathname;
const serverEntry = join(repoRoot, 'packages/server/dist/index.js');

// Source of truth for the expected tool surface — same extraction as
// scripts/check-registries-tools.mjs.
const dispatch = readFileSync(join(repoRoot, 'packages/server/src/dispatch.ts'), 'utf8');
const block = dispatch.match(/export const HANDLED_TOOLS = \[([\s\S]*?)\] as const;/);
if (!block) {
  console.error('conformance: could not find HANDLED_TOOLS in packages/server/src/dispatch.ts.');
  process.exit(1);
}
const expectedTools = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

if (!existsSync(serverEntry)) {
  console.error(
    `conformance: ${serverEntry} not found — run \`npm run build -w seekstone\` first.`,
  );
  process.exit(1);
}

// Scratch vault with known content. The search term must be distinctive
// enough that a ranked hit proves indexing, not luck.
const vault = mkdtempSync(join(tmpdir(), 'seekstone-conformance-'));
mkdirSync(join(vault, '.obsidian'), { recursive: true });
mkdirSync(join(vault, 'Notes'), { recursive: true });
const alphaFrontmatter = '---\ntitle: Alpha\ntags: [conformance]\n---\n';
const alphaBody = '# Alpha\n\nThe quartzite outcrop anchors the northern survey line.\n';
writeFileSync(join(vault, 'Notes', 'Alpha.md'), alphaFrontmatter + alphaBody);
writeFileSync(join(vault, 'Notes', 'Beta.md'), '# Beta\n\nLinks to [[Alpha]].\n');

const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(label);
};

const client = new Client({ name: 'seekstone-conformance', version: '0.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
  env: { ...process.env, SEEKSTONE_VAULT: vault },
  stderr: 'ignore',
});

try {
  // 1. Handshake. connect() performs the initialize round-trip.
  await client.connect(transport);
  const serverInfo = client.getServerVersion();
  check(
    serverInfo?.name === 'seekstone',
    'initialize: server identifies as seekstone',
    `got ${JSON.stringify(serverInfo)}`,
  );

  // 2. Tool surface matches HANDLED_TOOLS exactly.
  const { tools } = await client.listTools();
  const listed = tools.map((t) => t.name).sort();
  const expected = [...expectedTools].sort();
  check(
    JSON.stringify(listed) === JSON.stringify(expected),
    `tools/list: exactly the ${expected.length} registered tools`,
    `missing=[${expected.filter((t) => !listed.includes(t))}] extra=[${listed.filter((t) => !expected.includes(t))}]`,
  );
  check(
    tools.every((t) => t.description && t.inputSchema?.type === 'object'),
    'tools/list: every tool has a description and an object input schema',
  );

  // 3a. Read round-trip. The index builds at startup; retry briefly in case
  //     the first search lands before the walker finishes.
  let hits = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await client.callTool({ name: 'search', arguments: { query: 'quartzite' } });
    hits = JSON.parse(res.content[0].text);
    if (hits.length > 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check(
    hits.length === 1 &&
      hits[0].path === 'Notes/Alpha.md' &&
      /quartzite/.test(hits[0].excerpt ?? ''),
    'tools/call search: seeded note found with excerpt',
    JSON.stringify(hits).slice(0, 200),
  );

  // 3b. Write round-trip: content lands on disk, frontmatter byte-identical.
  const marker = 'Conformance gate wrote this line.';
  const res = await client.callTool({
    name: 'append_note',
    arguments: { path: 'Notes/Alpha.md', content: marker },
  });
  check(!res.isError, 'tools/call append_note: no error', res.content?.[0]?.text);
  const after = readFileSync(join(vault, 'Notes', 'Alpha.md'), 'utf8');
  check(after.includes(marker), 'append_note: marker present on disk');
  check(after.startsWith(alphaFrontmatter), 'append_note: frontmatter byte-identical');
} catch (err) {
  check(false, 'conformance run completed', err.message);
} finally {
  await client.close().catch(() => {});
  rmSync(vault, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✗ conformance failed: ${failures.length} check(s): ${failures.join('; ')}`);
  process.exit(1);
}
console.log('\n✓ MCP protocol conformance passed.');
