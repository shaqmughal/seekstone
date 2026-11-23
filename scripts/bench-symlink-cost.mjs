// Wall-clock cost of the SHA-575 symlink checks. CodSpeed runs in simulation
// mode and leaves out system-call time, and hot-paths.bench.ts keeps
// disk-bound costs out of CodSpeed on purpose (SHA-532), so the lstat walks
// are measured here instead.
//
// Run it against a checkout's server source and compare two checkouts:
//
//   node --import tsx scripts/bench-symlink-cost.mjs [repoRoot]
//
// repoRoot defaults to this checkout. Each row is the median of 5 batches.
// The script copies vault-1k to a temp folder for the write rows, so the
// committed fixtures are never written.

import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));
const src = join(root, 'packages', 'server', 'src');
const load = (p) => import(pathToFileURL(join(src, p)).href);

const { buildIndex } = await load('index/build.ts');
const { parseWritePolicy, readScopeWalk } = await load('policy.ts');
const { resolveVaultPath } = await load('vault-path.ts');
const { dispatch } = await load('dispatch.ts');
const { Journal } = await load('journal.ts');
const { createLogger } = await load('log.ts');
const symlinks = await load('symlinks.ts').catch(() => undefined);

const BATCHES = 5;
const FIXTURE_10K = join(root, 'packages', 'harness', 'fixtures', 'vault');
const FIXTURE_1K = join(root, 'packages', 'harness', 'fixtures', 'vault-1k');
const HUB = 'Encyclopedia/K/Kalinjar.md';
const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Median over batches of the mean µs per call. */
async function perCall(n, fn) {
  const batches = [];
  for (let b = 0; b < BATCHES; b++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) await fn(i);
    batches.push(Number(process.hrtime.bigint() - t0) / 1e3 / n);
  }
  return median(batches);
}

async function ctxFor(vaultRoot, env = {}) {
  const policy = parseWritePolicy(env);
  const built = await buildIndex(vaultRoot, readScopeWalk(policy));
  return {
    vaultRoot,
    index: built.index,
    notes: built.notes,
    generation: 0,
    backlinks: built.backlinks,
    attachments: built.attachments,
    policy,
  };
}

const rows = {};

// Read of a non-indexed path (3 components): the full link check.
const ctx10k = await ctxFor(FIXTURE_10K);
const readCtx = { vaultRoot: FIXTURE_10K, policy: ctx10k.policy };
rows['read of a non-indexed path (µs)'] = await perCall(20_000, () =>
  resolveVaultPath(readCtx, HUB),
);
if (symlinks?.crossesLink) {
  const abs = join(FIXTURE_10K, HUB);
  rows['crossesLink, 3 components (µs)'] = await perCall(20_000, () =>
    symlinks.crossesLink(FIXTURE_10K, abs),
  );
  rows['history check (µs)'] = await perCall(20_000, () =>
    symlinks.historyCrossesLink(FIXTURE_10K),
  );
}

// Boot index at 10k, unscoped and scoped to the whole vault (ms).
for (const [label, env] of [
  ['boot index @ 10k, unscoped (ms)', {}],
  ['boot index @ 10k, scoped to **/* (ms)', { SEEKSTONE_READ_PATHS: '**/*' }],
]) {
  const runs = [];
  for (let b = 0; b < BATCHES; b++) {
    const t0 = performance.now();
    await buildIndex(FIXTURE_10K, readScopeWalk(parseWritePolicy(env)));
    runs.push(performance.now() - t0);
  }
  rows[label] = median(runs);
}

// move_note's added work per rewritten note: the write check on each
// candidate (canWrite walks the path) plus upsertDoc's own walk after the
// rewrite. Measured on the hub note's real linkers in vault-1k.
const { canWrite } = await load('policy.ts');
if (canWrite && symlinks?.crossesLink) {
  const ctx1k = await ctxFor(FIXTURE_1K);
  const linkers = [...new Set((ctx1k.backlinks.get(HUB) ?? []).map((r) => r.path))];
  rows['move_note candidates (hub linkers)'] = linkers.length;
  rows['move_note per candidate: canWrite + upsertDoc walk (µs)'] =
    (await perCall(200, () => {
      for (const path of linkers) {
        canWrite(ctx1k.policy, path, FIXTURE_1K);
        symlinks.crossesLink(FIXTURE_1K, join(FIXTURE_1K, path));
      }
    })) / linkers.length;
}

// Writes on a scratch copy of vault-1k.
const scratch = mkdtempSync(join(tmpdir(), 'seekstone-symlink-cost-'));
try {
  const vault = join(scratch, 'vault');
  cpSync(FIXTURE_1K, vault, { recursive: true });
  const ctx = await ctxFor(vault);
  ctx.journal = await Journal.open(vault, { maxBytes: 1e12, maxEntries: 1e9 });
  let n = 0;
  rows['create_note, journaled (µs)'] = await perCall(200, async () => {
    n += 1;
    const r = await dispatch(ctx, 'create_note', { path: `bench/n${n}.md`, content: 'x' }, log);
    if (r.isError) throw new Error(r.content[0]?.text);
  });
  // The hub note has 269 inbound links: one write check per rewritten linker.
  let at = HUB;
  rows['move_note of the hub note, journaled (µs)'] = await perCall(10, async (i) => {
    const to = `Encyclopedia/K/Kalinjar-${i % 2}.md`;
    const r = await dispatch(ctx, 'move_note', { from: at, to }, log);
    if (r.isError) throw new Error(r.content[0]?.text);
    at = to;
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const out = Object.fromEntries(
  Object.entries(rows).map(([k, v]) => [k, Math.round(v * 100) / 100]),
);
console.log(JSON.stringify({ root, ...out }, null, 2));
