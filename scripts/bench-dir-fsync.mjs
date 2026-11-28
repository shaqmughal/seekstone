// Wall-clock cost of the folder fsync after each rename (SHA-652), which
// CodSpeed can't see: 500 journaled append_note calls per block on a fresh
// temp vault, fsync on and off, in the order on, off, off, on. Prints p50 and
// p95 per call in ms. The vault goes in --dir (default: the OS temp folder);
// on tmpfs fsync is nearly free, so point it at a real disk.
//
//   node scripts/bench-dir-fsync.mjs [--dir <folder>] [--calls <n>]

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { register } from 'tsx/esm/api';

register();

const { buildIndex } = await import('../packages/server/src/index/build.ts');
const { dispatch } = await import('../packages/server/src/dispatch.ts');
const { Journal } = await import('../packages/server/src/journal.ts');
const { createLogger } = await import('../packages/server/src/log.ts');
const { PERMISSIVE_POLICY } = await import('../packages/server/src/policy.ts');
const { setDirSyncEnabled } = await import('../packages/server/src/dir-sync.ts');

const { values: opts } = parseArgs({
  options: { dir: { type: 'string' }, calls: { type: 'string', default: '500' } },
});
const ROOT = resolve(opts.dir ?? tmpdir());
const CALLS = Number.parseInt(opts.calls, 10);
const ORDER = [true, false, false, true];
const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });

/** ms per append_note call, `CALLS` calls on a fresh vault. */
async function block(dirSync) {
  const vault = mkdtempSync(join(ROOT, 'seekstone-dir-fsync-'));
  try {
    mkdirSync(join(vault, 'notes'));
    writeFileSync(join(vault, 'notes', 'log.md'), '# Log\n');
    const built = await buildIndex(vault);
    const ctx = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    ctx.journal = await Journal.open(vault, { maxBytes: 1e12, maxEntries: 1e9 });
    setDirSyncEnabled(dirSync);
    const times = [];
    for (let i = 0; i < CALLS; i++) {
      const args = { path: 'notes/log.md', content: `- entry ${i}` };
      const t0 = process.hrtime.bigint();
      const r = await dispatch(ctx, 'append_note', args, log);
      times.push(Number(process.hrtime.bigint() - t0) / 1e6);
      if (r.isError) throw new Error(r.content[0]?.text);
    }
    return times;
  } finally {
    setDirSyncEnabled(true);
    rmSync(vault, { recursive: true, force: true });
  }
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const pct = (p) => Math.round(sorted[Math.floor(sorted.length * p)] * 1000) / 1000;
  return { calls: sorted.length, p50: pct(0.5), p95: pct(0.95) };
}

const samples = { on: [], off: [] };
const blocks = [];
for (const on of ORDER) {
  const times = await block(on);
  samples[on ? 'on' : 'off'].push(...times);
  blocks.push({ dirFsync: on ? 'on' : 'off', ...stats(times) });
}

const summary = { on: stats(samples.on), off: stats(samples.off) };
const round = (n) => Math.round(n * 1000) / 1000;
summary.addedAtP50 = round(summary.on.p50 - summary.off.p50);
console.log(JSON.stringify({ dir: ROOT, callsPerBlock: CALLS, blocks, ms: summary }, null, 2));
