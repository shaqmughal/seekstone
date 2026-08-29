import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { dispatch } from '../dispatch.js';
import { buildIndex } from '../index/build.js';
import { Journal } from '../journal.js';
import { createLogger } from '../log.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from './append_note.js';
import { createNote } from './create_note.js';
import { deleteNote } from './delete_note.js';
import { listWrites } from './list_writes.js';
import { moveNote } from './move_note.js';
import { patchFrontmatter } from './patch_frontmatter.js';
import { PatchNoteInput, patchNote } from './patch_note.js';
import { appendPeriodicNote, getPeriodicNote } from './periodic_note.js';
import { renameHeading } from './rename_heading.js';
import { ReplaceInNoteInput, replaceInNote } from './replace_in_note.js';
import { SearchInput, search } from './search.js';
import { undoWrite } from './undo_write.js';

/**
 * The acceptance test for SHA-298: for every write tool, write → undo_write
 * → the file is byte-identical to its pre-write state, multi-file tools are
 * restored whole, and the undo is itself journaled (undo the undo = redo).
 */

const A = `---
title: Alpha
tags: [x]
---
# Alpha

## Section
Body text mentioning hello twice: hello.

- item ^blk1
`;
const B = `# Beta

Links to [[Alpha]] and [[Alpha#Section|the section]] and [md](Alpha.md).
`;
const C = `# Gamma

Another [[Alpha]] link.
`;

let vault: string;
let ctx: ServerContext;

async function seedVault(): Promise<void> {
  await writeFile(join(vault, 'Alpha.md'), A, 'utf8');
  await writeFile(join(vault, 'Beta.md'), B, 'utf8');
  await writeFile(join(vault, 'Gamma.md'), C, 'utf8');
}

async function freshCtx(
  opts: { journal?: boolean; maxBytes?: number } = {},
): Promise<ServerContext> {
  const built = await buildIndex(vault);
  const c: ServerContext = {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    backlinks: built.backlinks,
    policy: PERMISSIVE_POLICY,
  };
  if (opts.journal !== false) {
    c.journal = await Journal.open(vault, { maxBytes: opts.maxBytes ?? 1e9, maxEntries: 1e6 });
  }
  return c;
}

async function disk(rel: string): Promise<string | null> {
  try {
    return await readFile(join(vault, rel), 'utf8');
  } catch {
    return null;
  }
}

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-undo-'));
  await seedVault();
  ctx = await freshCtx();
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('undo_write — byte-identical round trip per write tool', () => {
  it('append_note', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'appended' });
    expect(await disk('Alpha.md')).not.toBe(A);
    const r = await undoWrite(ctx, {});
    expect(r.tool).toBe('append_note');
    expect(r.restored).toEqual([{ path: 'Alpha.md', restoredHash: contentHash(A) }]);
    expect(await disk('Alpha.md')).toBe(A);
    expect(ctx.notes.get('Alpha.md')?.raw).toBe(A);
  });

  it('patch_frontmatter', async () => {
    await patchFrontmatter(ctx, { path: 'Alpha.md', patch: { status: 'done', title: null } });
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
    expect(ctx.notes.get('Alpha.md')?.fmKeys).toBe('title tags');
  });

  it('patch_note (heading replace and createIfMissing)', async () => {
    await patchNote(
      ctx,
      PatchNoteInput.parse({
        path: 'Alpha.md',
        target: { heading: 'Section' },
        operation: 'replace',
        content: 'gone',
      }),
    );
    await patchNote(
      ctx,
      PatchNoteInput.parse({
        path: 'Alpha.md',
        target: { heading: 'New' },
        operation: 'append',
        content: 'created',
        createIfMissing: true,
      }),
    );
    await undoWrite(ctx, {}); // the createIfMissing write
    await undoWrite(ctx, {}); // the replace
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('replace_in_note', async () => {
    await replaceInNote(
      ctx,
      ReplaceInNoteInput.parse({ path: 'Alpha.md', find: 'hello', replace: 'bye' }),
    );
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('create_note — undo removes a fresh note, restores an overwritten one', async () => {
    await createNote(ctx, { path: 'sub/New.md', content: 'fresh' });
    expect(ctx.notes.has('sub/New.md')).toBe(true);
    let r = await undoWrite(ctx, {});
    expect(r.restored).toEqual([{ path: 'sub/New.md', restoredHash: null }]);
    expect(await disk('sub/New.md')).toBeNull();
    expect(ctx.notes.has('sub/New.md')).toBe(false);

    await createNote(ctx, { path: 'Alpha.md', content: 'clobbered', overwrite: true });
    r = await undoWrite(ctx, {});
    expect(r.restored[0]?.restoredHash).toBe(contentHash(A));
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('delete_note — recoverable and permanent are both undoable', async () => {
    await deleteNote(ctx, { path: 'Alpha.md' });
    expect(await disk('Alpha.md')).toBeNull();
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
    expect(ctx.notes.has('Alpha.md')).toBe(true);
    expect(search(ctx, SearchInput.parse({ query: 'Alpha' }))[0]?.path).toBe('Alpha.md');

    await deleteNote(ctx, { path: 'Alpha.md', permanent: true });
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('append_periodic_note and get_periodic_note(createIfMissing)', async () => {
    const created = await getPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-01-03',
      createIfMissing: true,
    });
    expect(created.created).toBe(true);
    const appended = await appendPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-01-03',
      content: 'log line',
    });
    expect(appended.path).toBe(created.path);
    const rows = listWrites(ctx, {}).writes;
    expect(rows.map((w) => w.tool)).toEqual(['append_periodic_note', 'get_periodic_note']);

    await undoWrite(ctx, {});
    expect(await disk(created.path)).toBe(''); // back to the empty template-less note
    await undoWrite(ctx, {});
    expect(await disk(created.path)).toBeNull();

    // Fresh-create branch of append_periodic_note.
    await appendPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-01-04',
      content: 'first',
      createIfMissing: true,
    });
    await undoWrite(ctx, {});
    expect(listWrites(ctx, { limit: 1 }).writes[0]?.tool).toBe('undo_write');
  });

  it('move_note — restores the note at its old path AND every link rewrite, as one entry', async () => {
    const mv = await moveNote(ctx, { from: 'Alpha.md', to: 'archive/Alpha Renamed.md' });
    expect(mv.notesRewritten).toBe(2);
    expect(await disk('Beta.md')).not.toBe(B);

    const rows = listWrites(ctx, {}).writes;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.paths.sort()).toEqual(
      ['Alpha.md', 'Beta.md', 'Gamma.md', 'archive/Alpha Renamed.md'].sort(),
    );

    const r = await undoWrite(ctx, {});
    expect(r.restored).toHaveLength(4);
    expect(await disk('Alpha.md')).toBe(A);
    expect(await disk('archive/Alpha Renamed.md')).toBeNull();
    expect(await disk('Beta.md')).toBe(B);
    expect(await disk('Gamma.md')).toBe(C);
    // Index follows: the old path is back, the new one is gone, backlinks resolve again.
    expect(ctx.notes.has('Alpha.md')).toBe(true);
    expect(ctx.notes.has('archive/Alpha Renamed.md')).toBe(false);
    expect((ctx.backlinks.get('Alpha.md') ?? []).map((b) => b.path).sort()).toEqual([
      'Beta.md',
      'Gamma.md',
    ]);
  });

  it('move_note with overwrite restores the clobbered destination too', async () => {
    await moveNote(ctx, { from: 'Gamma.md', to: 'Beta.md', overwrite: true, rewriteLinks: false });
    expect(await disk('Beta.md')).toBe(C);
    await undoWrite(ctx, {});
    expect(await disk('Beta.md')).toBe(B);
    expect(await disk('Gamma.md')).toBe(C);
  });

  it('rename_heading — restores the note and every rewritten referrer', async () => {
    const rh = await renameHeading(ctx, {
      path: 'Alpha.md',
      oldHeading: 'Section',
      newHeading: 'Part',
    });
    expect(rh.linksRewritten).toBe(1);
    expect(await disk('Beta.md')).toContain('[[Alpha#Part|the section]]');
    expect(listWrites(ctx, {}).writes[0]?.paths.sort()).toEqual(['Alpha.md', 'Beta.md']);
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
    expect(await disk('Beta.md')).toBe(B);
  });
});

describe('undo_write — semantics', () => {
  it('undo is journaled; undoing the undo redoes the write', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'appended' });
    const after = await disk('Alpha.md');
    const undo = await undoWrite(ctx, {});
    expect(undo.seq).toBe(1);
    expect(undo.undoSeq).toBe(2);
    const rows = listWrites(ctx, {}).writes;
    expect(rows[0]).toMatchObject({ seq: 2, tool: 'undo_write', undoOf: 1, undoable: true });

    // Default undo never targets an undo entry (that would ping-pong); redo
    // is explicit by seq.
    await expect(undoWrite(ctx, {})).rejects.toThrow(/No undoable writes/);
    const redo = await undoWrite(ctx, { seq: undo.undoSeq });
    expect(redo).toMatchObject({ seq: 2, undoSeq: 3, tool: 'undo_write' });
    expect(await disk('Alpha.md')).toBe(after);
    // …and after a redo the original write is undoable by default again.
    expect((await undoWrite(ctx, {})).seq).toBe(1);
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('repeated default undos walk backwards through the history', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'one' });
    await appendNote(ctx, { path: 'Beta.md', content: 'two' });
    await appendNote(ctx, { path: 'Gamma.md', content: 'three' });
    expect((await undoWrite(ctx, {})).seq).toBe(3);
    expect((await undoWrite(ctx, {})).seq).toBe(2);
    expect((await undoWrite(ctx, {})).seq).toBe(1);
    expect([await disk('Alpha.md'), await disk('Beta.md'), await disk('Gamma.md')]).toEqual([
      A,
      B,
      C,
    ]);
    await expect(undoWrite(ctx, {})).rejects.toThrow(/No undoable writes/);
  });

  it('undo by explicit seq, out of order', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'one' }); // seq 1
    await appendNote(ctx, { path: 'Beta.md', content: 'two' }); // seq 2
    await undoWrite(ctx, { seq: 1 });
    expect(await disk('Alpha.md')).toBe(A);
    expect(await disk('Beta.md')).not.toBe(B);
  });

  it('refuses with undo_conflict when the file changed after the write, unless force', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'appended' });
    const external = `${await disk('Alpha.md')}external edit\n`;
    await writeFile(join(vault, 'Alpha.md'), external, 'utf8');

    let thrown: unknown;
    try {
      await undoWrite(ctx, {});
    } catch (err) {
      thrown = err;
    }
    const parsed = JSON.parse((thrown as Error).message);
    expect(parsed.error).toBe('undo_conflict');
    expect(parsed.seq).toBe(1);
    expect(parsed.conflicts).toHaveLength(1);
    expect(parsed.conflicts[0]).toMatchObject({
      path: 'Alpha.md',
      actualHash: contentHash(external),
      actualBytes: Buffer.byteLength(external),
    });
    expect(parsed.conflicts[0].expectedHash).not.toBe(contentHash(external));
    // Nothing moved, nothing journaled.
    expect(await disk('Alpha.md')).toBe(external);
    expect(listWrites(ctx, {}).total).toBe(1);

    const forced = await undoWrite(ctx, { force: true });
    expect(forced.overrode).toHaveLength(1);
    expect(await disk('Alpha.md')).toBe(A);
    // The clobbered external state was journaled first — still no data loss.
    const undoRow = listWrites(ctx, { limit: 1 }).writes[0];
    expect(undoRow?.tool).toBe('undo_write');
    const redo = await undoWrite(ctx, { seq: undoRow?.seq });
    expect(redo.restored[0]?.restoredHash).toBe(contentHash(external));
    expect(await disk('Alpha.md')).toBe(external);
  });

  it('multi-file undo is all-or-nothing on conflict', async () => {
    await moveNote(ctx, { from: 'Alpha.md', to: 'Moved.md' });
    await writeFile(join(vault, 'Beta.md'), 'tampered\n', 'utf8');
    await expect(undoWrite(ctx, {})).rejects.toThrow(/undo_conflict/);
    expect(await disk('Moved.md')).not.toBeNull();
    expect(await disk('Alpha.md')).toBeNull();
    expect(await disk('Beta.md')).toBe('tampered\n');
  });

  it('a deleted-then-recreated file counts as a conflict', async () => {
    await deleteNote(ctx, { path: 'Alpha.md' });
    await writeFile(join(vault, 'Alpha.md'), 'recreated\n', 'utf8');
    await expect(undoWrite(ctx, {})).rejects.toThrow(/undo_conflict/);
  });

  it('reports evicted entries as not undoable and refuses to undo them', async () => {
    ctx = await freshCtx({ maxBytes: A.length + 10 });
    await appendNote(ctx, { path: 'Alpha.md', content: 'one' }); // pre = A
    await appendNote(ctx, { path: 'Beta.md', content: 'two' }); // pre = B → over cap → evict 1
    const rows = listWrites(ctx, {}).writes;
    expect(rows.find((r) => r.seq === 1)?.undoable).toBe(false);
    await expect(undoWrite(ctx, { seq: 1 })).rejects.toThrow(/entry_evicted/);
    // Default picks the latest UNDOABLE entry, skipping the evicted one.
    const r = await undoWrite(ctx, {});
    expect(r.seq).toBe(2);
    expect(await disk('Beta.md')).toBe(B);
  });

  it('errors cleanly with nothing to undo, an unknown seq, or a disabled journal', async () => {
    await expect(undoWrite(ctx, {})).rejects.toThrow(/No undoable writes/);
    await expect(undoWrite(ctx, { seq: 99 })).rejects.toThrow(/not found/);
    const off = await freshCtx({ journal: false });
    await expect(undoWrite(off, {})).rejects.toThrow(/disabled/);
    expect(listWrites(off, {})).toEqual({ writes: [], total: 0, disabled: true });
  });

  it('respects write-path scoping on every restored path', async () => {
    await moveNote(ctx, { from: 'Alpha.md', to: 'Moved.md' });
    ctx.policy = { readOnly: false, writeGlobs: ['Moved.md', 'Alpha.md'] };
    // Beta.md / Gamma.md were rewritten by the move and are now out of scope.
    await expect(undoWrite(ctx, {})).rejects.toThrow(/Write not permitted/);
    expect(await disk('Moved.md')).not.toBeNull();
  });

  it('journal failure aborts the vault write', async () => {
    // Make the blob dir unwritable by replacing it with a file.
    await rm(join(vault, '.seekstone', 'history', 'blobs'), { recursive: true });
    await writeFile(join(vault, '.seekstone', 'history', 'blobs'), 'not a dir', 'utf8');
    await expect(appendNote(ctx, { path: 'Alpha.md', content: 'x' })).rejects.toThrow();
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('writes skip the journal entirely when it is disabled', async () => {
    const off = await freshCtx({ journal: false });
    await rm(join(vault, '.seekstone'), { recursive: true, force: true });
    await appendNote(off, { path: 'Alpha.md', content: 'x' });
    await expect(access(join(vault, '.seekstone'))).rejects.toThrow();
  });

  it('journal contents never appear in the index or search results', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'zebra-unique-token' });
    await replaceInNote(
      ctx,
      ReplaceInNoteInput.parse({ path: 'Alpha.md', find: 'zebra-unique-token', replace: 'x' }),
    );
    // The pre-image with the token now lives only under .seekstone/history.
    await mkdir(join(vault, '.seekstone', 'history', 'blobs'), { recursive: true });
    const rebuilt = await buildIndex(vault);
    for (const path of rebuilt.notes.keys()) expect(path.startsWith('.seekstone')).toBe(false);
    const hits = search(
      { ...ctx, index: rebuilt.index, notes: rebuilt.notes },
      SearchInput.parse({ query: 'zebra-unique-token' }),
    );
    expect(hits).toHaveLength(0);
  });
});

describe('dispatch integration', () => {
  const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });

  it('list_writes rows are metadata only and undo_write round-trips through dispatch', async () => {
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'via dispatch' }, log);
    const listed = await dispatch(ctx, 'list_writes', {}, log);
    const text = listed.content[0]?.text ?? '';
    expect(text).not.toContain('via dispatch');
    expect(JSON.parse(text).writes[0]).toMatchObject({ seq: 1, tool: 'append_note' });

    const undone = await dispatch(ctx, 'undo_write', {}, log);
    expect(undone.isError).toBeUndefined();
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('read-only mode rejects undo_write but serves list_writes', async () => {
    ctx.policy = { readOnly: true };
    const rejected = await dispatch(ctx, 'undo_write', {}, log);
    expect(rejected.isError).toBe(true);
    const listed = await dispatch(ctx, 'list_writes', {}, log);
    expect(listed.isError).toBeUndefined();
  });
});

describe('coverage of edge branches', () => {
  it('list_writes filters by path', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'a' });
    await appendNote(ctx, { path: 'Beta.md', content: 'b' });
    expect(listWrites(ctx, { path: 'Beta.md' }).writes.map((w) => w.seq)).toEqual([2]);
  });

  it('create_note overwrite with prevHash on a vanished note is a hash_conflict', async () => {
    await expect(
      createNote(ctx, { path: 'Nope.md', content: 'x', overwrite: true, prevHash: 'abc' }),
    ).rejects.toThrow(/hash_conflict/);
    expect(await disk('Nope.md')).toBeNull();
  });

  it('move_note surfaces a non-ENOENT destination error (directory)', async () => {
    await mkdir(join(vault, 'dir.md'));
    await expect(
      moveNote(ctx, { from: 'Alpha.md', to: 'dir.md', overwrite: true }),
    ).rejects.toThrow();
    expect(await disk('Alpha.md')).toBe(A);
  });

  it('move_note skips out-of-scope referrers and journals only the rewritten ones', async () => {
    ctx.policy = { readOnly: false, writeGlobs: ['Alpha.md', 'Moved.md', 'Beta.md'] };
    const mv = await moveNote(ctx, { from: 'Alpha.md', to: 'Moved.md' });
    expect(mv.skipped).toEqual(['Gamma.md']);
    const paths = listWrites(ctx, {}).writes[0]?.paths ?? [];
    expect(paths).not.toContain('Gamma.md');
    ctx.policy = PERMISSIVE_POLICY;
    await undoWrite(ctx, {});
    expect(await disk('Alpha.md')).toBe(A);
    expect(await disk('Beta.md')).toBe(B);
  });

  it('conflict on a deleted post-state reports null expected bytes', async () => {
    await deleteNote(ctx, { path: 'Alpha.md' });
    await writeFile(join(vault, 'Alpha.md'), 'back\n', 'utf8');
    let msg = '';
    try {
      await undoWrite(ctx, {});
    } catch (err) {
      msg = (err as Error).message;
    }
    const c = JSON.parse(msg).conflicts[0];
    expect(c.expectedHash).toBeNull();
    expect(c.expectedBytes).toBeNull();
  });

  it('conflict on a modified post-state reports expected bytes when the journal holds them', async () => {
    await appendNote(ctx, { path: 'Alpha.md', content: 'one' }); // seq 1: A -> A1
    const a1 = await disk('Alpha.md');
    await appendNote(ctx, { path: 'Alpha.md', content: 'two' }); // seq 2: pre = A1 (blob stored)
    await writeFile(join(vault, 'Alpha.md'), 'external\n', 'utf8');
    let msg = '';
    try {
      await undoWrite(ctx, { seq: 1 });
    } catch (err) {
      msg = (err as Error).message;
    }
    const c = JSON.parse(msg).conflicts[0];
    expect(c.expectedBytes).toBe(Buffer.byteLength(a1 ?? ''));
  });

  it('undo of a create whose file was never indexed still cleans up', async () => {
    await createNote(ctx, { path: 'notes.txt', content: 'plain' });
    ctx.index.discard('notes.txt');
    ctx.notes.delete('notes.txt');
    await undoWrite(ctx, {});
    expect(await disk('notes.txt')).toBeNull();
    // Restoring a non-.md path skips the index entirely.
    await createNote(ctx, { path: 'notes.txt', content: 'v1' });
    await createNote(ctx, { path: 'notes.txt', content: 'v2', overwrite: true });
    await undoWrite(ctx, {});
    expect(await disk('notes.txt')).toBe('v1');
  });
});
