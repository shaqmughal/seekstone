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
import { deleteNote } from './delete_note.js';
import { moveNote } from './move_note.js';
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

  it('replace_in_note: dry runs and zero-match calls return the unchanged hash', async () => {
    const { path, hash } = await seed('rin-dry.md');
    const flags = { regex: false, caseSensitive: false, wholeWord: false };
    const dry = await replaceInNote(ctx, {
      path,
      find: 'Original',
      replace: 'X',
      ...flags,
      dryRun: true,
    });
    expect(dry.contentHash).toBe(hash);
    const noMatch = await replaceInNote(ctx, {
      path,
      find: 'zz_never_present',
      replace: 'X',
      ...flags,
      dryRun: false,
    });
    expect(noMatch.replacements).toBe(0);
    expect(noMatch.contentHash).toBe(hash);
    // The returned hash chains: a guarded edit straight from the dry run works.
    const chained = await appendNote(ctx, {
      path,
      content: 'after dry',
      prevHash: dry.contentHash,
    });
    expect(chained.contentHash).toBe(contentHash(await readFile(join(tmpDir, path), 'utf8')));
  });

  it('move_note: match moves and returns the hash at the new path; stale conflicts and leaves the file in place', async () => {
    const { path, hash } = await seed('mv.md');
    const ok = await moveNote(ctx, { from: path, to: 'moved/mv.md', prevHash: hash });
    // A rename never changes content — the returned hash is the moved bytes'.
    expect(ok.contentHash).toBe(hash);
    expect(await readFile(join(tmpDir, 'moved/mv.md'), 'utf8')).toBe(NOTE);

    // Stale guard: tamper out-of-band, then attempt a move with the old hash.
    await appendNote(ctx, { path: 'moved/mv.md', content: 'drift' });
    await moveNote(ctx, { from: 'moved/mv.md', to: 'moved/elsewhere.md', prevHash: hash }).then(
      () => {
        throw new Error('expected hash_conflict');
      },
      (err) => expectHashConflict(err, hash),
    );
    // Refused move leaves the source in place and creates no destination.
    await expect(readFile(join(tmpDir, 'moved/mv.md'), 'utf8')).resolves.toContain('drift');
    await expect(readFile(join(tmpDir, 'moved/elsewhere.md'), 'utf8')).rejects.toThrow();
  });

  it('delete_note: match deletes and returns the trashed content hash; stale conflicts and leaves the note', async () => {
    const { path, hash } = await seed('del.md');
    // Stale guard first: tamper, then attempt delete with the pre-tamper hash.
    await appendNote(ctx, { path, content: 'drift' });
    await deleteNote(ctx, { path, prevHash: hash }).then(
      () => {
        throw new Error('expected hash_conflict');
      },
      (err) => expectHashConflict(err, hash),
    );
    const tampered = await readFile(join(tmpDir, path), 'utf8');
    expect(tampered).toContain('drift');

    // Matching guard deletes; hash identifies the byte-identical .trash/ copy.
    const ok = await deleteNote(ctx, { path, prevHash: contentHash(tampered) });
    expect(ok.contentHash).toBe(contentHash(tampered));
    expect(ok.trashedTo).toBeDefined();
    expect(await readFile(join(tmpDir, ok.trashedTo as string), 'utf8')).toBe(tampered);
    await expect(readFile(join(tmpDir, path), 'utf8')).rejects.toThrow();
  });

  it('delete_note: permanent delete also honors the guard and reports the destroyed hash', async () => {
    const { path, hash } = await seed('del-perm.md');
    const ok = await deleteNote(ctx, { path, permanent: true, prevHash: hash });
    expect(ok.contentHash).toBe(hash);
    expect(ok.trashedTo).toBeUndefined();
    await expect(readFile(join(tmpDir, path), 'utf8')).rejects.toThrow();
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
