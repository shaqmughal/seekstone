import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { extractLinksWithLines } from '@seekstone/core/extract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { Journal } from '../journal.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { createNote } from '../tools/create_note.js';
import { deleteNote } from '../tools/delete_note.js';
import { listWrites } from '../tools/list_writes.js';
import { moveNote } from '../tools/move_note.js';
import { ReplaceInNoteInput, replaceInNote } from '../tools/replace_in_note.js';
import { undoWrite } from '../tools/undo_write.js';
import { addNoteBacklinks, removeNoteBacklinks } from './backlinks.js';
import { buildIndex } from './build.js';
import { buildDoc, removeDoc, upsertDoc } from './doc.js';
import { addAttachment, buildResolveMaps, resolveAttachment, resolveLink } from './resolve.js';
import { listUnresolved, type UnresolvedRow } from './unresolved.js';

const FIXTURE = resolve(import.meta.dirname, '../../../harness/fixtures/vault-1k');

let vault: string;
let ctx: ServerContext;

async function freshCtx(root: string): Promise<ServerContext> {
  const journal = await Journal.open(root, { maxBytes: 1e9, maxEntries: 1e6 });
  return { ...(await buildIndex(root)), vaultRoot: root, policy: PERMISSIVE_POLICY, journal };
}

/** Extract and resolve every link of every note: one row per (note, line, target). */
function bruteForce(c: ServerContext): UnresolvedRow[] {
  const maps = buildResolveMaps(c.notes);
  const rows: UnresolvedRow[] = [];
  for (const path of [...c.notes.keys()].sort((a, b) => (a < b ? -1 : 1))) {
    const seen = new Set<string>();
    const links = extractLinksWithLines(c.notes.get(path)?.raw ?? '');
    for (const l of links
      .map((l, i) => ({ ...l, i }))
      .sort((a, b) => a.line - b.line || a.i - b.i)) {
      if (resolveLink(l.target, c.notes, maps) || resolveAttachment(l.target, c.attachments))
        continue;
      if (seen.has(`${l.line}\0${l.target}`)) continue;
      seen.add(`${l.line}\0${l.target}`);
      rows.push({ path, line: l.line, target: l.target, linkType: l.linkType });
    }
  }
  return rows;
}

/** What the watcher does for an add or change event (watcher.ts upsert). */
async function watcherWrite(path: string, raw: string): Promise<void> {
  await writeFile(join(ctx.vaultRoot, path), raw, 'utf8');
  removeNoteBacklinks(ctx, path);
  if (upsertDoc(ctx, buildDoc(path, raw))) addNoteBacklinks(ctx, path, raw);
}

/** What the watcher does for an unlink event (watcher.ts remove). */
async function watcherUnlink(path: string): Promise<void> {
  await rm(join(ctx.vaultRoot, path));
  removeDoc(ctx, path);
}

const rowsFor = (target: string) => listUnresolved(ctx).filter((r) => r.target === target);
const key = (r: UnresolvedRow) => `${r.path}\0${r.line}\0${r.target}`;

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('listUnresolved on vault-1k', () => {
  beforeEach(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-unresolved-'));
    await cp(FIXTURE, vault, { recursive: true });
    ctx = await freshCtx(vault);
  });

  it('equals a brute-force scan after the boot build and after each write', async () => {
    const check = (step: string) => expect(listUnresolved(ctx), step).toEqual(bruteForce(ctx));
    check('boot');
    // Two calls on an unchanged index give deep-equal, separate arrays.
    expect(listUnresolved(ctx)).toEqual(listUnresolved(ctx));
    expect(listUnresolved(ctx)).not.toBe(listUnresolved(ctx));

    // The three most-linked notes, and one other note to edit.
    const [hub, second, third] = [...ctx.backlinks]
      .filter(([t, refs]) => ctx.notes.has(t) && refs.some((r) => r.path !== t))
      .sort(([a, ra], [b, rb]) => rb.length - ra.length || (a < b ? -1 : 1))
      .map(([t]) => t) as [string, string, string];
    const editor = [...ctx.notes.keys()].find((p) => ![hub, second, third].includes(p)) as string;
    const editorRaw = ctx.notes.get(editor)?.raw as string;

    const broken = '[[Missing Note]] [[Gone Forever]] ![[nowhere.png]] [[Missing Note]]';
    await watcherWrite(editor, `${editorRaw}\n${broken}\n`);
    check('edit adds broken links');
    expect(rowsFor('Missing Note')).toHaveLength(1);
    expect(rowsFor('nowhere.png')[0]?.linkType).toBe('embed');

    await createNote(ctx, { path: 'Missing Note.md', content: 'now here' });
    check('create the note a link names');
    expect(rowsFor('Missing Note')).toEqual([]);

    const find = '[[Gone Forever]] ';
    await replaceInNote(ctx, ReplaceInNoteInput.parse({ path: editor, find, replace: '' }));
    check('edit removes a broken link');
    expect(rowsFor('Gone Forever')).toEqual([]);

    // Deleting a note lists its linkers' links to it on the next call.
    const linkers = new Set(
      ctx.backlinks
        .get(hub)
        ?.map((r) => r.path)
        .filter((p) => p !== hub),
    );
    const old = new Set(listUnresolved(ctx).map(key));
    await deleteNote(ctx, { path: hub });
    check('delete_note');
    const added = listUnresolved(ctx).filter((r) => !old.has(key(r)));
    expect(added.length).toBeGreaterThan(0);
    expect(new Set(added.map((r) => r.path))).toEqual(linkers);
    const deleteSeq = (await listWrites(ctx, {})).writes[0]?.seq;

    const secondRaw = ctx.notes.get(second)?.raw as string;
    await watcherUnlink(second);
    check('watcher unlink');

    await moveNote(ctx, { from: third, to: `Moved/${third.split('/').pop()}` });
    check('move_note');

    expect((await undoWrite(ctx, { seq: deleteSeq })).tool).toBe('delete_note');
    expect(ctx.notes.has(hub)).toBe(true);
    check('undo_write of the delete');

    await watcherWrite(second, secondRaw);
    check('the deleted note comes back');
  });
});

describe('listUnresolved on a small vault', () => {
  beforeEach(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-unresolved-'));
    const a = '# A\n![[x.png]] ![[y.png]]\n[[Missing]] [[Missing|again]] [[Missing#h]]\n';
    await writeFile(join(vault, 'A.md'), a);
    await mkdir(join(vault, 'img'));
    await writeFile(join(vault, 'img', 'x.png'), 'png');
    await writeFile(join(vault, 'sub-B.md'), '[[Nowhere]]\n');
    ctx = await freshCtx(vault);
  });

  it('skips an embed whose file exists anywhere, and lists one that does not', () => {
    expect(listUnresolved(ctx)).toEqual([
      { path: 'A.md', line: 2, target: 'y.png', linkType: 'embed' },
      { path: 'A.md', line: 3, target: 'Missing', linkType: 'wikilink' },
      { path: 'sub-B.md', line: 1, target: 'Nowhere', linkType: 'wikilink' },
    ]);
    addAttachment(ctx.attachments, 'later/y.png');
    expect(listUnresolved(ctx).map((r) => r.target)).toEqual(['Missing', 'Nowhere']);
  });

  it('drops links to a note created since', async () => {
    await createNote(ctx, { path: 'deep/Missing.md', content: '' });
    expect(listUnresolved(ctx).map((r) => r.target)).toEqual(['y.png', 'Nowhere']);
  });

  it('limits rows to sources under the folder prefix', () => {
    expect(listUnresolved(ctx, { folder: 'sub' }).map((r) => r.path)).toEqual(['sub-B.md']);
    expect(listUnresolved(ctx, { folder: 'A.md' })).toHaveLength(2);
    expect(listUnresolved(ctx, { folder: 'empty/' })).toEqual([]);
  });

  it('a link that falls back to a same-named note stays resolved, then breaks when that note goes', async () => {
    await mkdir(join(vault, 'a'));
    await mkdir(join(vault, 'b'));
    await writeFile(join(vault, 'a', 'Dup.md'), 'self [[Dup]] and [[Lost]]\n');
    await writeFile(join(vault, 'b', 'Dup.md'), 'other\n');
    await writeFile(join(vault, 'C.md'), '[[Dup]]\n');
    ctx = await freshCtx(vault);
    await deleteNote(ctx, { path: 'a/Dup.md' });
    expect(listUnresolved(ctx)).toEqual(bruteForce(ctx));
    expect(ctx.unresolved.has('C.md')).toBe(false);
    expect(ctx.unresolved.has('a/Dup.md')).toBe(false);
    // The link now falls back to b/Dup.md, so deleting that one breaks it.
    expect(ctx.backlinks.get('b/Dup.md')?.map((r) => r.path)).toEqual(['C.md']);
    await deleteNote(ctx, { path: 'b/Dup.md' });
    expect(ctx.unresolved.has('C.md')).toBe(true);
    expect(listUnresolved(ctx)).toEqual(bruteForce(ctx));
  });

  it('forgets a removed note and keeps a note with no links out', async () => {
    await watcherWrite('A.md', 'no links now\n');
    expect(ctx.unresolved.has('A.md')).toBe(false);
    await watcherUnlink('sub-B.md');
    expect(ctx.unresolved.has('sub-B.md')).toBe(false);
    expect(listUnresolved(ctx)).toEqual([]);
  });
});
