import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { dispatch } from '../dispatch.js';
import { buildIndex } from '../index/build.js';
import type { IndexedNote } from '../index/types.js';
import { createLogger } from '../log.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { getBacklinks } from './get_backlinks.js';
import { listTags } from './list_tags.js';
import { vaultStats } from './vault_stats.js';

// Spy (not stub) on every fs export, so the no-disk-reads test can count calls.
vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 21);

function ctxOf(notes: Array<{ id: string; size?: number; tags?: string; ageDays?: number }>) {
  const map = new Map<string, IndexedNote>();
  for (const n of notes) {
    map.set(n.id, {
      id: n.id,
      title: n.id,
      body: '',
      tags: n.tags ?? '',
      fmKeys: '',
      fm: null,
      raw: '',
      tasks: [],
      sizeBytes: n.size ?? 10,
      mtimeMs: NOW - (n.ageDays ?? 100) * DAY,
    });
  }
  const ctx: ServerContext = {
    vaultRoot: '/vault',
    index: new MiniSearch<IndexedNote>({ fields: ['title'] }),
    notes: map,
    backlinks: new Map(),
    policy: PERMISSIVE_POLICY,
  };
  return ctx;
}

describe('vaultStats', () => {
  it('counts notes, folders, tags and bytes', () => {
    const ctx = ctxOf([
      { id: 'a/one.md', size: 30, tags: 'work area/work' },
      { id: 'a/two.md', size: 10, tags: 'work' },
      { id: 'a/b/three.md', size: 20 },
      { id: 'root.md', size: 50, tags: 'daily' },
    ]);
    ctx.backlinks.set('root.md', [
      { path: 'a/one.md', line: 1, linkType: 'wikilink' },
      { path: 'a/two.md', line: 3, linkType: 'embed' },
    ]);
    ctx.backlinks.set('a/one.md', [{ path: 'root.md', line: 2, linkType: 'wikilink' }]);
    expect(vaultStats(ctx, NOW)).toEqual({
      notes: 4,
      folders: 2,
      tags: { unique: 3, tagged: 3 },
      links: { resolved: 3 },
      bytes: { total: 110, median: 20, largest: { path: 'root.md', size: 50 } },
      modified: { d1: 0, d7: 0, d30: 0 },
    });
  });

  it('takes the middle size for an odd count and the lower middle for an even count', () => {
    const odd = ctxOf([
      { id: 'a.md', size: 9 },
      { id: 'b.md', size: 1 },
      { id: 'c.md', size: 5 },
    ]);
    expect(vaultStats(odd, NOW).bytes.median).toBe(5);
    const even = ctxOf([
      { id: 'a.md', size: 40 },
      { id: 'b.md', size: 10 },
      { id: 'c.md', size: 30 },
      { id: 'd.md', size: 20 },
    ]);
    expect(vaultStats(even, NOW).bytes.median).toBe(20);
  });

  it('breaks a tie for the largest note on path, whatever the map order', () => {
    const ctx = ctxOf([
      { id: 'z.md', size: 7 },
      { id: 'm.md', size: 7 },
      { id: 'q.md', size: 7 },
    ]);
    expect(vaultStats(ctx, NOW).bytes.largest).toEqual({ path: 'm.md', size: 7 });
  });

  it('buckets modified notes into 1, 7 and 30 day windows of the given now', () => {
    const ctx = ctxOf([
      { id: 'a.md', ageDays: 0.5 },
      { id: 'b.md', ageDays: 1 },
      { id: 'c.md', ageDays: 6.9 },
      { id: 'd.md', ageDays: 29 },
      { id: 'e.md', ageDays: 30 },
      { id: 'f.md', ageDays: 400 },
    ]);
    expect(vaultStats(ctx, NOW).modified).toEqual({ d1: 1, d7: 3, d30: 4 });
    expect(vaultStats(ctx, NOW + 365 * DAY).modified).toEqual({ d1: 0, d7: 0, d30: 0 });
  });

  it('returns zeros and omits bytes.largest for an empty vault', () => {
    const stats = vaultStats(ctxOf([]), NOW);
    expect(stats).toEqual({
      notes: 0,
      folders: 0,
      tags: { unique: 0, tagged: 0 },
      links: { resolved: 0 },
      bytes: { total: 0, median: 0 },
      modified: { d1: 0, d7: 0, d30: 0 },
    });
    expect('largest' in stats.bytes).toBe(false);
  });

  it('counts no folders when every note is at the root', () => {
    expect(vaultStats(ctxOf([{ id: 'a.md' }, { id: 'b.md' }]), NOW).folders).toBe(0);
  });
});

describe('vault_stats on a real index', () => {
  let root: string;
  let ctx: ServerContext;
  const log = createLogger({ env: {}, stderr: () => {} });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-stats-'));
    await mkdir(join(root, 'Projects'));
    await writeFile(join(root, 'Home.md'), '# Home\n[[Alpha]] [[Alpha]] [[Beta]] #hub\n');
    await writeFile(join(root, 'Projects/Alpha.md'), '---\ntags: [work]\n---\n[[Beta]] [[Nope]]\n');
    await writeFile(join(root, 'Projects/Beta.md'), '# Beta\n![[Home]] #work #area/x\n');
    const built = await buildIndex(root);
    ctx = { ...built, vaultRoot: root, policy: PERMISSIVE_POLICY };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('agrees with list_tags and get_backlinks', () => {
    const stats = vaultStats(ctx);
    expect(stats.tags.unique).toBe(listTags(ctx, { sort: 'count' }).total);
    let backlinks = 0;
    for (const path of ctx.notes.keys()) backlinks += getBacklinks(ctx, { path }).total;
    expect(stats.links.resolved).toBe(backlinks);
    expect(stats.links.resolved).toBe(4);
  });

  it('reads no files, works read-only, and returns minified JSON without optional blocks', async () => {
    // Guard the guard: the spies must be live, or the loop below proves nothing.
    expect(vi.isMockFunction(fsp.readFile) && vi.isMockFunction(fs.readFileSync)).toBe(true);
    vi.clearAllMocks();
    const res = await dispatch({ ...ctx, policy: { readOnly: true } }, 'vault_stats', {}, log);
    for (const mod of [fs, fsp] as Record<string, unknown>[]) {
      for (const [name, fn] of Object.entries(mod)) {
        if (vi.isMockFunction(fn)) expect(fn, name).not.toHaveBeenCalled();
      }
    }
    expect(res.isError).toBeUndefined();
    const text = res.content[0]?.text ?? '';
    const body = JSON.parse(text);
    expect(text).toBe(JSON.stringify(body));
    expect(body.notes).toBe(3);
    expect(body).not.toHaveProperty('health');
    expect(body).not.toHaveProperty('attachments');
  });

  it('accepts a call that omits arguments', async () => {
    const res = await dispatch(ctx, 'vault_stats', undefined, log);
    expect(res.isError).toBeUndefined();
    expect(JSON.parse(res.content[0]?.text ?? '').notes).toBe(3);
  });
});
