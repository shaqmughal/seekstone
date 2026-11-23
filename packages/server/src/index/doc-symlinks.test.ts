import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { buildIndex } from './build.js';
import { buildDoc, replaceDoc, upsertDoc } from './doc.js';

/**
 * SHA-575: upsertDoc keeps a path that crosses a symlink out of the index,
 * removes an entry already there the usual way (inbound refs parked), and
 * reports false so callers skip backlink and semantic updates.
 */

let base: string;
let vault: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'seekstone-doc-links-'));
  vault = join(base, 'vault');
  mkdirSync(join(vault, 'f'), { recursive: true });
  writeFileSync(join(vault, 'a.md'), 'See [[b]].\n');
  writeFileSync(join(vault, 'c.md'), '# C\n');
  writeFileSync(join(vault, 'f', 'b.md'), 'Links to [[c]].\n');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

async function ctxWithLinkedFolder(): Promise<ServerContext> {
  const built = await buildIndex(vault);
  const ctx: ServerContext = {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    generation: 0,
    backlinks: built.backlinks,
    attachments: built.attachments,
    policy: PERMISSIVE_POLICY,
  };
  // Swap the indexed note's folder for a link (to a copy outside the vault).
  renameSync(join(vault, 'f'), join(base, 'f-out'));
  symlinkSync(
    join(base, 'f-out'),
    join(vault, 'f'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  return ctx;
}

const inbound = (ctx: ServerContext, path: string) =>
  (ctx.backlinks.get(path) ?? []).map((r) => r.path);

describe('upsertDoc and replaceDoc on a linked path', () => {
  it('refuses, removes the existing entry and parks its inbound refs', async () => {
    const ctx = await ctxWithLinkedFolder();
    expect(ctx.notes.has('f/b.md')).toBe(true);
    expect(inbound(ctx, 'f/b.md')).toEqual(['a.md']);
    expect(inbound(ctx, 'c.md')).toEqual(['f/b.md']);
    const gen = ctx.generation;

    expect(upsertDoc(ctx, buildDoc('f/b.md', 'Links to [[c]] and more.\n'))).toBe(false);
    expect(ctx.notes.has('f/b.md')).toBe(false);
    expect(ctx.index.search('more').some((h) => h.id === 'f/b.md')).toBe(false);
    expect(ctx.backlinks.has('f/b.md')).toBe(false);
    expect(ctx.parkedBacklinks?.get('f/b.md')?.map((r) => r.path)).toEqual(['a.md']);
    // Its own outgoing ref to c.md is cleared, not re-added.
    expect(inbound(ctx, 'c.md')).toEqual([]);
    expect(ctx.generation).toBeGreaterThan(gen);
  });

  it('replaceDoc returns false and registers no backlinks', async () => {
    const ctx = await ctxWithLinkedFolder();
    expect(replaceDoc(ctx, 'f/b.md', 'Now links to [[a]].\n')).toBe(false);
    expect(ctx.notes.has('f/b.md')).toBe(false);
    expect(inbound(ctx, 'a.md')).toEqual([]);
  });

  it('admits a new note on a linked path as nothing (false, not indexed)', async () => {
    const ctx = await ctxWithLinkedFolder();
    expect(upsertDoc(ctx, buildDoc('f/new.md', '# New\n'))).toBe(false);
    expect(ctx.notes.has('f/new.md')).toBe(false);
  });

  it('still admits an ordinary path', async () => {
    const ctx = await ctxWithLinkedFolder();
    expect(upsertDoc(ctx, buildDoc('d.md', '# D\n'))).toBe(true);
    expect(ctx.notes.has('d.md')).toBe(true);
  });
});
