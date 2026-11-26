import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { link, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks } from '../index/backlinks.js';
import { buildAttachmentIndex } from '../index/resolve.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { moveNote } from './move_note.js';

let tmpDir: string;
let ctx: ServerContext;

/**
 * Whether the temp filesystem treats two different spellings as one file.
 * APFS and NTFS fold case; APFS also ignores Unicode normalization. Linux
 * filesystems usually do neither, so the tests that need it skip there.
 */
function sameFileOnDisk(written: string, probe: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), 'seekstone-fs-probe-'));
  try {
    writeFileSync(join(dir, written), '');
    return existsSync(join(dir, probe));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const caseInsensitiveFs = sameFileOnDisk('probe.md', 'PROBE.md');
const normalizationInsensitiveFs = sameFileOnDisk('caf\u00e9.md', 'cafe\u0301.md');

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
    generation: 0,
    backlinks: new Map(),
    attachments: buildAttachmentIndex([]),
    policy: PERMISSIVE_POLICY,
  };
}

function seedInto(target: ServerContext, relPath: string, raw: string): IndexedNote {
  const doc: IndexedNote = {
    id: relPath,
    title: relPath,
    body: raw,
    tags: '',
    fmKeys: '',
    fm: null,
    raw,
    tasks: [],
    sizeBytes: Buffer.byteLength(raw, 'utf8'),
    mtimeMs: Date.now(),
  };
  target.notes.set(relPath, doc);
  target.index.add(doc);
  return doc;
}

function seedNote(relPath: string, raw: string): IndexedNote {
  const doc: IndexedNote = {
    id: relPath,
    title: relPath,
    body: raw,
    tags: '',
    fmKeys: '',
    fm: null,
    raw,
    tasks: [],
    sizeBytes: Buffer.byteLength(raw, 'utf8'),
    mtimeMs: Date.now(),
  };
  ctx.notes.set(relPath, doc);
  ctx.index.add(doc);
  return doc;
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-move-note-test-'));
  ctx = freshCtx();
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('moveNote', () => {
  it('moves the file on disk', async () => {
    await writeFile(join(tmpDir, 'src.md'), 'content', 'utf8');
    await moveNote(ctx, { from: 'src.md', to: 'dst.md' });
    await expect(readFile(join(tmpDir, 'src.md'), 'utf8')).rejects.toThrow();
    const disk = await readFile(join(tmpDir, 'dst.md'), 'utf8');
    expect(disk).toBe('content');
  });

  it('updates the in-memory index — old path gone, new path present', async () => {
    const raw = 'unique_move_term_qwerty';
    await writeFile(join(tmpDir, 'old.md'), raw, 'utf8');
    seedNote('old.md', raw);

    await moveNote(ctx, { from: 'old.md', to: 'new.md' });

    expect(ctx.notes.has('old.md')).toBe(false);
    expect(ctx.notes.has('new.md')).toBe(true);
    expect(ctx.index.search('unique_move_term_qwerty').some((h) => h.id === 'new.md')).toBe(true);
    expect(ctx.index.search('unique_move_term_qwerty').some((h) => h.id === 'old.md')).toBe(false);
  });

  it('creates parent directories automatically', async () => {
    await writeFile(join(tmpDir, 'flat.md'), 'hi', 'utf8');
    await moveNote(ctx, { from: 'flat.md', to: 'deep/nested/flat.md' });
    const disk = await readFile(join(tmpDir, 'deep/nested/flat.md'), 'utf8');
    expect(disk).toBe('hi');
  });

  it('returns from and to paths', async () => {
    await writeFile(join(tmpDir, 'a.md'), '', 'utf8');
    const result = await moveNote(ctx, { from: 'a.md', to: 'b.md' });
    expect(result.from).toBe('a.md');
    expect(result.to).toBe('b.md');
  });

  it('throws if source does not exist', async () => {
    await expect(moveNote(ctx, { from: 'missing.md', to: 'anywhere.md' })).rejects.toThrow(
      'Note not found',
    );
  });

  it('throws if destination exists and overwrite is false (default)', async () => {
    await writeFile(join(tmpDir, 'keep-src.md'), 'original', 'utf8');
    await writeFile(join(tmpDir, 'keep-dst.md'), 'existing', 'utf8');
    await expect(moveNote(ctx, { from: 'keep-src.md', to: 'keep-dst.md' })).rejects.toThrow(
      'already exists',
    );
    // source must be untouched
    expect(await readFile(join(tmpDir, 'keep-src.md'), 'utf8')).toBe('original');
  });

  it('overwrites destination when overwrite: true', async () => {
    await writeFile(join(tmpDir, 'over-src.md'), 'new', 'utf8');
    await writeFile(join(tmpDir, 'over-dst.md'), 'old', 'utf8');
    await moveNote(ctx, { from: 'over-src.md', to: 'over-dst.md', overwrite: true });
    expect(await readFile(join(tmpDir, 'over-dst.md'), 'utf8')).toBe('new');
  });

  it.each([
    ['a wikilink', 'See [[ow-link-src]].'],
    ['a markdown link', 'See [it](ow-link-src.md).'],
  ])(
    'keeps the moved bytes when the overwritten destination had %s to the source',
    async (_, dstRaw) => {
      const local = freshCtx();
      const srcRaw = 'the moved note';
      await writeFile(join(tmpDir, 'ow-link-src.md'), srcRaw, 'utf8');
      await writeFile(join(tmpDir, 'ow-link-dst.md'), dstRaw, 'utf8');
      seedInto(local, 'ow-link-src.md', srcRaw);
      seedInto(local, 'ow-link-dst.md', dstRaw);
      addNoteBacklinks(local, 'ow-link-dst.md', dstRaw);

      const result = await moveNote(local, {
        from: 'ow-link-src.md',
        to: 'ow-link-dst.md',
        overwrite: true,
      });

      // The old destination is discarded by the overwrite, so it is not a link
      // to rewrite; rewriting it would put its stale bytes back over the move.
      expect(await readFile(join(tmpDir, 'ow-link-dst.md'), 'utf8')).toBe(srcRaw);
      expect(local.notes.get('ow-link-dst.md')?.raw).toBe(srcRaw);
      expect(result.notesRewritten).toBe(0);
    },
  );

  const fold = (k: string) => k.normalize('NFC').toLowerCase();
  // Index keys that name `key` up to case and Unicode normalization.
  const keysLike = (target: ServerContext, key: string) =>
    [...target.notes.keys()].filter((k) => fold(k) === fold(key));

  it('keeps the moved bytes when `to` is spelled ./name.md and the destination links to the source', async () => {
    const local = freshCtx();
    const srcRaw = 'the moved note';
    const dstRaw = 'See [[ow-dot-src]] and [[ow-dot-other]].';
    await writeFile(join(tmpDir, 'ow-dot-src.md'), srcRaw, 'utf8');
    await writeFile(join(tmpDir, 'ow-dot-dst.md'), dstRaw, 'utf8');
    seedInto(local, 'ow-dot-src.md', srcRaw);
    seedInto(local, 'ow-dot-dst.md', dstRaw);
    seedInto(local, 'ow-dot-other.md', '');
    addNoteBacklinks(local, 'ow-dot-dst.md', dstRaw);

    const result = await moveNote(local, {
      from: 'ow-dot-src.md',
      to: './ow-dot-dst.md',
      overwrite: true,
    });

    // The candidate set is keyed by vault-relative path, so the destination
    // must be excluded by its resolved key, not the raw `to` string.
    expect(await readFile(join(tmpDir, 'ow-dot-dst.md'), 'utf8')).toBe(srcRaw);
    expect(result.contentHash).toBe(contentHash(srcRaw));
    expect(result.notesRewritten).toBe(0);
    // One index entry for the destination, under its vault key, holding the
    // moved note. The replaced note's outgoing links went with it.
    expect([...local.notes.keys()].filter((k) => k.endsWith('ow-dot-dst.md'))).toEqual([
      'ow-dot-dst.md',
    ]);
    expect(local.notes.get('ow-dot-dst.md')?.raw).toBe(srcRaw);
    expect(local.backlinks.get('ow-dot-other.md') ?? []).toEqual([]);
  });

  // `to` spells an existing note differently. Whether that is the same file
  // depends on the filesystem, so the test branches on a probe instead of
  // skipping, and the invariant that holds everywhere is checked first.
  // The spelling the directories store for `key`, one segment at a time.
  async function storedSpelling(key: string): Promise<string> {
    const out: string[] = [];
    for (const seg of key.split('/')) {
      const hits = (await readdir(join(tmpDir, ...out))).filter((n) => fold(n) === fold(seg));
      expect(hits).toHaveLength(1);
      out.push(hits[0] ?? seg);
    }
    return out.join('/');
  }

  async function moveOntoRespelledDestination(
    dstKey: string,
    to: string,
    fsFolds: boolean,
  ): Promise<void> {
    const local = freshCtx();
    const srcRaw = 'the moved note';
    const flat = dstKey.replaceAll('/', '-');
    const srcKey = `src-for-${flat}`;
    const otherKey = `other-for-${flat}`;
    const dstRaw = `See [[${srcKey.slice(0, -3)}]] and [[${otherKey.slice(0, -3)}]].`;
    await mkdir(dirname(join(tmpDir, dstKey)), { recursive: true });
    await writeFile(join(tmpDir, srcKey), srcRaw, 'utf8');
    await writeFile(join(tmpDir, dstKey), dstRaw, 'utf8');
    seedInto(local, srcKey, srcRaw);
    seedInto(local, dstKey, dstRaw);
    seedInto(local, otherKey, '');
    addNoteBacklinks(local, dstKey, dstRaw);

    const result = await moveNote(local, { from: srcKey, to, overwrite: true });

    // Everywhere: the moved bytes are at `to` and the hash describes them.
    const atTo = await readFile(join(tmpDir, result.to), 'utf8');
    expect(atTo).toBe(srcRaw);
    expect(result.contentHash).toBe(contentHash(atTo));

    if (fsFolds) {
      // One file under two spellings: the old destination was overwritten,
      // so its link rewrite must not run and clobber the moved note.
      expect(result.notesRewritten).toBe(0);
      // The index holds one entry for it, under the name now on disk, with
      // the moved content. The replaced note's outgoing links are gone.
      const stored = await storedSpelling(dstKey);
      expect(keysLike(local, dstKey)).toEqual([stored]);
      expect(local.notes.get(stored)?.raw).toBe(srcRaw);
      expect(local.backlinks.get(otherKey) ?? []).toEqual([]);
    } else {
      // Two files: the old destination is a separate note that linked to the
      // source. It keeps existing and never receives the moved bytes.
      expect(await readFile(join(tmpDir, dstKey), 'utf8')).not.toBe(srcRaw);
      expect(local.notes.get(to)?.raw).toBe(srcRaw);
      expect(local.notes.has(dstKey)).toBe(true);
    }
  }

  it('keeps the moved bytes when `to` names the existing destination in a different case', () =>
    moveOntoRespelledDestination('ow-case-dst.md', 'OW-CASE-DST.md', caseInsensitiveFs));

  it('keeps the moved bytes when `to` names the existing destination in NFD instead of NFC', () =>
    moveOntoRespelledDestination(
      'ow-caf\u00e9.md',
      'ow-cafe\u0301.md',
      normalizationInsensitiveFs,
    ));

  it('keeps the moved bytes when `to` names the destination folder in a different case', () =>
    moveOntoRespelledDestination('ow-sub/dst.md', 'OW-SUB/dst.md', caseInsensitiveFs));

  it('still rewrites a hard link to the overwritten destination', async () => {
    const local = freshCtx();
    const srcRaw = 'the moved note';
    const dstRaw = 'See [[hl-src]].';
    await writeFile(join(tmpDir, 'hl-src.md'), srcRaw, 'utf8');
    await writeFile(join(tmpDir, 'hl-dst.md'), dstRaw, 'utf8');
    await link(join(tmpDir, 'hl-dst.md'), join(tmpDir, 'hl-other.md'));
    for (const [k, raw] of [
      ['hl-src.md', srcRaw],
      ['hl-dst.md', dstRaw],
      ['hl-other.md', dstRaw],
    ] as const) {
      seedInto(local, k, raw);
      addNoteBacklinks(local, k, raw);
    }

    const result = await moveNote(local, { from: 'hl-src.md', to: 'hl-dst.md', overwrite: true });

    // The hard link is its own note: after the rename it keeps the old inode,
    // so its link to the moved note is rewritten. Only the destination is not.
    expect(await readFile(join(tmpDir, 'hl-dst.md'), 'utf8')).toBe(srcRaw);
    expect(await readFile(join(tmpDir, 'hl-other.md'), 'utf8')).not.toBe(dstRaw);
    expect(result.notesRewritten).toBe(1);
  });

  it('throws on path traversal in from', async () => {
    await expect(moveNote(ctx, { from: '../escape.md', to: 'safe.md' })).rejects.toThrow(
      'Path outside vault',
    );
  });

  it('throws on path traversal in to', async () => {
    await writeFile(join(tmpDir, 'legit.md'), '', 'utf8');
    await expect(moveNote(ctx, { from: 'legit.md', to: '../escape.md' })).rejects.toThrow(
      'Path outside vault',
    );
  });

  it('rewrites a referencing wikilink when the basename changes', async () => {
    const localCtx = freshCtx();
    await mkdir(join(tmpDir, 'lw'), { recursive: true });
    await writeFile(join(tmpDir, 'lw/target.md'), '# Target', 'utf8');
    await writeFile(
      join(tmpDir, 'lw/ref.md'),
      'See [[target|the note]] and ![[target#Sec]].',
      'utf8',
    );
    seedInto(localCtx, 'lw/target.md', '# Target');
    seedInto(localCtx, 'lw/ref.md', 'See [[target|the note]] and ![[target#Sec]].');
    addNoteBacklinks(localCtx, 'lw/ref.md', localCtx.notes.get('lw/ref.md')?.raw ?? '');

    const result = await moveNote(localCtx, { from: 'lw/target.md', to: 'lw/renamed.md' });

    expect(result.notesRewritten).toBe(1);
    expect(result.linksRewritten).toBe(2);
    const disk = await readFile(join(tmpDir, 'lw/ref.md'), 'utf8');
    expect(disk).toBe('See [[renamed|the note]] and ![[renamed#Sec]].');
    // Backlink index re-keyed: refs now live under the new path.
    expect(localCtx.backlinks.get('lw/target.md')).toBeUndefined();
    expect(localCtx.backlinks.get('lw/renamed.md')?.map((r) => r.path)).toEqual(['lw/ref.md']);
    expect(localCtx.notes.get('lw/ref.md')?.raw).toContain('[[renamed|the note]]');
  });

  it('rewrites nothing on a folder move with unchanged, unambiguous basename', async () => {
    const localCtx = freshCtx();
    await mkdir(join(tmpDir, 'fm/sub'), { recursive: true });
    await writeFile(join(tmpDir, 'fm/stable.md'), '# S', 'utf8');
    await writeFile(join(tmpDir, 'fm/ref2.md'), 'Link: [[stable]].', 'utf8');
    seedInto(localCtx, 'fm/stable.md', '# S');
    seedInto(localCtx, 'fm/ref2.md', 'Link: [[stable]].');
    addNoteBacklinks(localCtx, 'fm/ref2.md', 'Link: [[stable]].');

    const result = await moveNote(localCtx, { from: 'fm/stable.md', to: 'fm/sub/stable.md' });

    expect(result.notesRewritten).toBe(0);
    expect(result.linksRewritten).toBe(0);
    expect(await readFile(join(tmpDir, 'fm/ref2.md'), 'utf8')).toBe('Link: [[stable]].');
    // Refs still re-keyed to the new path even though nothing was rewritten.
    expect(localCtx.backlinks.get('fm/stable.md')).toBeUndefined();
    expect(localCtx.backlinks.get('fm/sub/stable.md')?.map((r) => r.path)).toEqual(['fm/ref2.md']);
  });

  it('discovers and rewrites markdown-link references the backlink index cannot see', async () => {
    const localCtx = freshCtx();
    await mkdir(join(tmpDir, 'md'), { recursive: true });
    await writeFile(join(tmpDir, 'md/doc.md'), '# D', 'utf8');
    await writeFile(join(tmpDir, 'md/refmd.md'), 'Read [the doc](doc.md).', 'utf8');
    seedInto(localCtx, 'md/doc.md', '# D');
    seedInto(localCtx, 'md/refmd.md', 'Read [the doc](doc.md).');
    // No backlink seeding on purpose — markdown links are not in the index.

    const result = await moveNote(localCtx, { from: 'md/doc.md', to: 'md/archive/doc2.md' });

    expect(result.notesRewritten).toBe(1);
    expect(await readFile(join(tmpDir, 'md/refmd.md'), 'utf8')).toBe(
      'Read [the doc](archive/doc2.md).',
    );
  });

  it('leaves links in fenced code blocks untouched', async () => {
    const localCtx = freshCtx();
    await mkdir(join(tmpDir, 'fence'), { recursive: true });
    const refRaw = '[[fenced-t]]\n```\n[[fenced-t]]\n```\n';
    await writeFile(join(tmpDir, 'fence/fenced-t.md'), '#T', 'utf8');
    await writeFile(join(tmpDir, 'fence/fref.md'), refRaw, 'utf8');
    seedInto(localCtx, 'fence/fenced-t.md', '#T');
    seedInto(localCtx, 'fence/fref.md', refRaw);
    addNoteBacklinks(localCtx, 'fence/fref.md', refRaw);

    const result = await moveNote(localCtx, { from: 'fence/fenced-t.md', to: 'fence/f2.md' });

    expect(result.linksRewritten).toBe(1);
    expect(await readFile(join(tmpDir, 'fence/fref.md'), 'utf8')).toBe(
      '[[f2]]\n```\n[[fenced-t]]\n```\n',
    );
  });

  it('rewriteLinks: false moves the file only', async () => {
    const localCtx = freshCtx();
    await mkdir(join(tmpDir, 'off'), { recursive: true });
    await writeFile(join(tmpDir, 'off/t.md'), '#T', 'utf8');
    await writeFile(join(tmpDir, 'off/r.md'), '[[t]]', 'utf8');
    seedInto(localCtx, 'off/t.md', '#T');
    seedInto(localCtx, 'off/r.md', '[[t]]');
    addNoteBacklinks(localCtx, 'off/r.md', '[[t]]');

    const result = await moveNote(localCtx, {
      from: 'off/t.md',
      to: 'off/renamed-t.md',
      rewriteLinks: false,
    });

    expect(result.notesRewritten).toBe(0);
    expect(await readFile(join(tmpDir, 'off/r.md'), 'utf8')).toBe('[[t]]');
  });

  it('skips and reports referencing notes outside the write-path allowlist', async () => {
    const localCtx = freshCtx();
    localCtx.policy = { readOnly: false, writeGlobs: ['scope/**'] };
    await mkdir(join(tmpDir, 'scope'), { recursive: true });
    await mkdir(join(tmpDir, 'outside'), { recursive: true });
    await writeFile(join(tmpDir, 'scope/starget.md'), '#T', 'utf8');
    await writeFile(join(tmpDir, 'scope/sref.md'), '[[starget]]', 'utf8');
    await writeFile(join(tmpDir, 'outside/oref.md'), '[[starget]]', 'utf8');
    seedInto(localCtx, 'scope/starget.md', '#T');
    seedInto(localCtx, 'scope/sref.md', '[[starget]]');
    seedInto(localCtx, 'outside/oref.md', '[[starget]]');
    addNoteBacklinks(localCtx, 'scope/sref.md', '[[starget]]');
    addNoteBacklinks(localCtx, 'outside/oref.md', '[[starget]]');

    const result = await moveNote(localCtx, {
      from: 'scope/starget.md',
      to: 'scope/srenamed.md',
    });

    expect(result.notesRewritten).toBe(1);
    expect(result.skipped).toEqual(['outside/oref.md']);
    expect(await readFile(join(tmpDir, 'scope/sref.md'), 'utf8')).toBe('[[srenamed]]');
    // Out-of-scope note untouched on disk — its stale link is reported, not modified.
    expect(await readFile(join(tmpDir, 'outside/oref.md'), 'utf8')).toBe('[[starget]]');
  });

  it('rejects a move whose destination is outside the write-path allowlist', async () => {
    await writeFile(join(tmpDir, 'journal', 'in-scope.md'), '', 'utf8').catch(async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmpDir, 'journal'), { recursive: true });
      await writeFile(join(tmpDir, 'journal', 'in-scope.md'), '', 'utf8');
    });
    const scoped = { ...freshCtx(), policy: { readOnly: false, writeGlobs: ['journal/**'] } };
    await expect(
      moveNote(scoped, { from: 'journal/in-scope.md', to: 'archive/out.md' }),
    ).rejects.toThrow('Write not permitted');
    // Both endpoints in scope succeeds.
    await expect(
      moveNote(scoped, { from: 'journal/in-scope.md', to: 'journal/renamed.md' }),
    ).resolves.toMatchObject({ to: 'journal/renamed.md' });
  });
});
