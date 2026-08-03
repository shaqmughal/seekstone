import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from './append_note.js';
import { createNote } from './create_note.js';
import { patchFrontmatter } from './patch_frontmatter.js';
import { patchNote } from './patch_note.js';
import { readNote } from './read_note.js';
import { replaceInNote } from './replace_in_note.js';

/**
 * Compare-and-swap behavior across every edit tool that accepts prevHash:
 * matching hash succeeds, stale hash fails with hash_conflict + current hash
 * and leaves the disk untouched, omitted hash keeps today's behavior.
 */

const NOTE = `---
title: CAS target
---

# Heading

Original body words here.
`;

let tmpDir: string;
let ctx: ServerContext;

function freshCtx(): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return {
    vaultRoot: tmpDir,
    index,
    notes: new Map(),
    backlinks: new Map(),
    policy: PERMISSIVE_POLICY,
  };
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-cas-test-'));
  ctx = freshCtx();
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function seed(name: string): Promise<{ path: string; hash: string }> {
  await writeFile(join(tmpDir, name), NOTE, 'utf8');
  return { path: name, hash: contentHash(NOTE) };
}

function expectHashConflict(err: unknown, expectedStale: string): void {
  const parsed = JSON.parse((err as Error).message);
  expect(parsed.error).toBe('hash_conflict');
  expect(parsed.expected).toBe(expectedStale);
  expect(typeof parsed.actual === 'string' || parsed.actual === null).toBe(true);
}

describe('read_note contentHash', () => {
  it('returns the whole-file hash for whole and span reads', async () => {
    const { path, hash } = await seed('rn.md');
    const whole = await readNote(ctx, { path });
    expect(whole.contentHash).toBe(hash);
    const span = await readNote(ctx, { path, section: 'Heading' });
    expect(span.contentHash).toBe(hash); // still the file's hash, not the span's
  });
});

describe('CAS on edit tools', () => {
  it('append_note: match succeeds and returns the new hash; stale conflicts and leaves disk untouched', async () => {
    const { path, hash } = await seed('ap.md');
    const ok = await appendNote(ctx, { path, content: 'appended', prevHash: hash });
    expect(ok.contentHash).toBe(contentHash(await readFile(join(tmpDir, path), 'utf8')));

    const before = await readFile(join(tmpDir, path), 'utf8');
    const stale = hash; // file changed since this hash
    await appendNote(ctx, { path, content: 'nope', prevHash: stale }).then(
      () => {
        throw new Error('expected hash_conflict');
      },
      (err) => expectHashConflict(err, stale),
    );
    expect(await readFile(join(tmpDir, path), 'utf8')).toBe(before);
  });

  it('supports chained edits using each result hash', async () => {
    const { path, hash } = await seed('chain.md');
    const first = await appendNote(ctx, { path, content: 'one', prevHash: hash });
    const second = await appendNote(ctx, { path, content: 'two', prevHash: first.contentHash });
    expect(second.contentHash).toBe(contentHash(await readFile(join(tmpDir, path), 'utf8')));
  });

  it('patch_note: stale hash conflicts before any edit', async () => {
    const { path, hash } = await seed('pn.md');
    await appendNote(ctx, { path, content: 'drift' }); // invalidate hash
    await expect(
      patchNote(ctx, {
        path,
        target: { heading: 'Heading' },
        operation: 'append',
        content: 'x',
        createIfMissing: false,
        prevHash: hash,
      }),
    ).rejects.toThrow(/hash_conflict/);
  });

  it('patch_frontmatter: match succeeds, stale conflicts', async () => {
    const { path, hash } = await seed('pf.md');
    const ok = await patchFrontmatter(ctx, { path, patch: { status: 'done' }, prevHash: hash });
    expect(ok.contentHash).toBe(contentHash(await readFile(join(tmpDir, path), 'utf8')));
    await expect(
      patchFrontmatter(ctx, { path, patch: { status: 'again' }, prevHash: hash }),
    ).rejects.toThrow(/hash_conflict/);
  });

  it('replace_in_note: stale conflicts even on dryRun', async () => {
    const { path, hash } = await seed('rin.md');
    const flags = { regex: false, caseSensitive: false, wholeWord: false };
    const ok = await replaceInNote(ctx, {
      path,
      find: 'Original',
      replace: 'Replaced',
      ...flags,
      dryRun: false,
      prevHash: hash,
    });
    expect(ok.contentHash).toBeDefined();
    await expect(
      replaceInNote(ctx, { path, find: 'x', replace: 'y', ...flags, dryRun: true, prevHash: hash }),
    ).rejects.toThrow(/hash_conflict/);
  });

  it('omitting prevHash keeps unguarded behavior', async () => {
    const { path } = await seed('open.md');
    await appendNote(ctx, { path, content: 'no guard' });
    const disk = await readFile(join(tmpDir, path), 'utf8');
    expect(disk).toContain('no guard');
  });
});

describe('create_note prevHash', () => {
  it('rejects prevHash without overwrite (zod refine)', async () => {
    await expect(
      createNote(ctx, { path: 'ref.md', content: 'x', prevHash: 'abc' }),
    ).rejects.toThrow(/overwrite/);
  });

  it('guards overwrite: match replaces, stale conflicts', async () => {
    const { path, hash } = await seed('ow.md');
    const ok = await createNote(ctx, {
      path,
      content: 'replaced',
      overwrite: true,
      prevHash: hash,
    });
    expect(ok.contentHash).toBe(contentHash('replaced'));
    await expect(
      createNote(ctx, { path, content: 'again', overwrite: true, prevHash: hash }),
    ).rejects.toThrow(/hash_conflict/);
    expect(await readFile(join(tmpDir, path), 'utf8')).toBe('replaced');
  });
});
