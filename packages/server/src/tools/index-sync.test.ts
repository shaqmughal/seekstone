import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks } from '../index/backlinks.js';
import { buildIndex } from '../index/build.js';
import { replaceDoc } from '../index/doc.js';
import { Journal } from '../journal.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from './append_note.js';
import { createNote } from './create_note.js';
import { deleteNote } from './delete_note.js';
import { getBacklinks } from './get_backlinks.js';
import { getLinks } from './get_links.js';
import { listTags } from './list_tags.js';
import { listWrites } from './list_writes.js';
import { moveNote } from './move_note.js';
import { patchFrontmatter } from './patch_frontmatter.js';
import { patchNote } from './patch_note.js';
import { appendPeriodicNote, getPeriodicNote } from './periodic_note.js';
import { renameHeading } from './rename_heading.js';
import { replaceInNote } from './replace_in_note.js';
import { undoWrite } from './undo_write.js';
import { updateTask } from './update_task.js';
import { vaultStats } from './vault_stats.js';

// Every write tool updates the in-memory index itself, so vault_stats and
// get_backlinks must match a cold rebuild right after the call, with no
// watcher running. Link additions are left to the watcher by design, so
// these cases add no new links.
//
// list_tags, vault_stats and get_links cache by index generation (SHA-461).
// Each case fills those caches before the write (prime), so a write that
// skips the bump shows up here as a stale result.

let root: string;
let ctx: ServerContext;

async function cold(): Promise<ServerContext> {
  return { ...(await buildIndex(root)), vaultRoot: root, policy: PERMISSIVE_POLICY };
}

/** target → sorted "source:line:linkType" refs, for targets that are live notes. */
function linkSets(c: ServerContext): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [target, refs] of c.backlinks) {
    if (c.notes.has(target) && refs.length > 0)
      out[target] = refs.map((r) => `${r.path}:${r.line}:${r.linkType}`).sort();
  }
  return out;
}

/** Every note's outlinks, as get_links reports them. */
function outlinks(c: ServerContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of [...c.notes.keys()].sort()) out[path] = getLinks(c, { path }).links;
  return out;
}

/** Call every cached tool once, so the next call after a write could hit a stale cache. */
function prime(c: ServerContext): void {
  vaultStats(c);
  listTags(c, { sort: 'count' });
  listTags(c, { sort: 'name' });
  outlinks(c);
}

async function expectInSync(): Promise<void> {
  const fresh = await cold();
  expect(vaultStats(ctx)).toEqual(vaultStats(fresh));
  expect(listTags(ctx, { sort: 'count' })).toEqual(listTags(fresh, { sort: 'count' }));
  expect(listTags(ctx, { sort: 'name' })).toEqual(listTags(fresh, { sort: 'name' }));
  expect(outlinks(ctx)).toEqual(outlinks(fresh));
  expect(linkSets(ctx)).toEqual(linkSets(fresh));
  // Writes only touch notes, so the attachment index must be left as it was.
  expect(ctx.attachments).toEqual(fresh.attachments);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'seekstone-index-sync-'));
  await mkdir(join(root, 'A'));
  await writeFile(
    join(root, 'Home.md'),
    '# Home\n\nSee [[Beta]] and [[Gamma]].\n\n## Log\n\nstart\n',
  );
  await writeFile(
    join(root, 'A/Beta.md'),
    '---\ntags: [work]\nrel: "[[Gamma]]"\n---\n- [ ] ship it\n',
  );
  await writeFile(join(root, 'Gamma.md'), '# Gamma\n\n[[Home]]\n');
  await writeFile(join(root, 'A/diagram.png'), 'png');
  ctx = await cold();
  ctx.journal = await Journal.open(root, { maxBytes: 1e9, maxEntries: 1e6 });
  prime(ctx);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('the index matches a cold rebuild right after each write', () => {
  it('append_note', async () => {
    await appendNote(ctx, { path: 'Gamma.md', content: 'a much longer line #fresh\n'.repeat(20) });
    await expectInSync();
  });

  it('append_periodic_note on an existing note', async () => {
    await writeFile(join(root, '2026-11-21.md'), 'day\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    await appendPeriodicNote(ctx, { date: '2026-11-21', content: 'more text for the day' });
    await expectInSync();
  });

  it('patch_note replacing a section that held a link', async () => {
    await patchNote(ctx, {
      path: 'Home.md',
      target: { heading: 'Home' },
      operation: 'replace',
      content: 'no links here, and a longer body than before\n',
      createIfMissing: false,
    });
    await expectInSync();
  });

  it('replace_in_note removing a link', async () => {
    await replaceInNote(ctx, {
      path: 'Home.md',
      find: '[[Gamma]]',
      replace: 'nothing',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    await expectInSync();
  });

  it('update_task', async () => {
    await updateTask(ctx, { path: 'A/Beta.md', line: 5, state: 'x' });
    await expectInSync();
  });

  it('patch_frontmatter dropping a frontmatter link and adding a tag', async () => {
    await patchFrontmatter(ctx, { path: 'A/Beta.md', patch: { rel: null, tags: ['work', 'new'] } });
    await expectInSync();
  });

  it('patch_frontmatter removing an alias the note links to', async () => {
    await writeFile(join(root, 'Self.md'), '---\naliases: [Shortcut]\n---\nSee [[Shortcut]].\n');
    await writeFile(join(root, 'Zed.md'), '---\naliases: [Shortcut]\n---\nother\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    expect(getBacklinks(ctx, { path: 'Zed.md' }).total).toBe(0);
    await patchFrontmatter(ctx, { path: 'Self.md', patch: { aliases: null } });
    await expectInSync();
  });

  it('create_note of a new tagged note', async () => {
    await createNote(ctx, { path: 'Fresh.md', content: '#brand-new body', overwrite: false });
    await expectInSync();
  });

  it('get_periodic_note creating the day note', async () => {
    await getPeriodicNote(ctx, { period: 'daily', date: '2026-11-22', createIfMissing: true });
    await expectInSync();
  });

  it('rename_heading rewriting a heading link in another note', async () => {
    await writeFile(join(root, 'Gamma.md'), '# Gamma\n\n[[Home#Log]]\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    await renameHeading(ctx, { path: 'Home.md', oldHeading: 'Log', newHeading: 'Journal' });
    await expectInSync();
  });

  it('create_note overwriting a note that had links', async () => {
    await createNote(ctx, { path: 'Home.md', content: 'replaced, no links', overwrite: true });
    await expectInSync();
  });

  it('delete_note of a link target', async () => {
    await deleteNote(ctx, { path: 'Gamma.md' });
    await expectInSync();
    expect(vaultStats(ctx).links.resolved).toBe(1);
  });

  it('delete_note, then undo_write brings the inbound links back', async () => {
    await deleteNote(ctx, { path: 'Gamma.md' });
    await undoWrite(ctx, {});
    await expectInSync();
    expect(vaultStats(ctx).links.resolved).toBe(4);
  });

  it('a restored note gets back inbound links from notes that still exist', async () => {
    const gone = await deleteNote(ctx, { path: 'Gamma.md' });
    expect(gone.permanent).toBe(false);
    expect(getBacklinks(ctx, { path: 'Gamma.md' }).total).toBe(0);
    await deleteNote(ctx, { path: 'Home.md' });
    const [first] = listWrites(ctx, { path: 'Gamma.md' }).writes;
    await undoWrite(ctx, { seq: first?.seq });
    await expectInSync();
    expect(getBacklinks(ctx, { path: 'Gamma.md' }).backlinks.map((b) => b.path)).toEqual([
      'A/Beta.md',
    ]);
  });

  it('a link removed while its target is deleted stays gone after undo_write (SHA-572)', async () => {
    await deleteNote(ctx, { path: 'Gamma.md' });
    await replaceInNote(ctx, {
      path: 'Home.md',
      find: '[[Gamma]]',
      replace: 'nothing',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    const [del] = listWrites(ctx, { path: 'Gamma.md' }).writes;
    await undoWrite(ctx, { seq: del?.seq });
    await expectInSync();
    expect(getBacklinks(ctx, { path: 'Gamma.md' }).backlinks.map((b) => b.path)).toEqual([
      'A/Beta.md',
    ]);
  });

  it('a link added while its target is deleted counts once create_note brings it back (SHA-572)', async () => {
    await writeFile(join(root, 'C.md'), 'no links yet\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    await deleteNote(ctx, { path: 'Gamma.md' });
    await appendNote(ctx, { path: 'C.md', content: 'now [[Gamma]]' });
    await createNote(ctx, { path: 'Gamma.md', content: '# Gamma\n', overwrite: false });
    await expectInSync();
    expect(getBacklinks(ctx, { path: 'Gamma.md' }).backlinks.map((b) => b.path)).toEqual([
      'A/Beta.md',
      'C.md',
      'Home.md',
    ]);
  });

  it('a note nobody linked to when it was deleted gets links added since (SHA-572)', async () => {
    await createNote(ctx, { path: 'Lone.md', content: 'alone', overwrite: false });
    await deleteNote(ctx, { path: 'Lone.md' });
    await appendNote(ctx, { path: 'Home.md', content: 'see [[Lone]]' });
    const [del] = listWrites(ctx, { path: 'Lone.md' }).writes;
    await undoWrite(ctx, { seq: del?.seq });
    await expectInSync();
    expect(getBacklinks(ctx, { path: 'Lone.md' }).backlinks.map((b) => b.path)).toEqual([
      'Home.md',
    ]);
  });

  it('a returning note takes a link back from a note with the same basename (SHA-572)', async () => {
    await mkdir(join(root, 'B'));
    await writeFile(join(root, 'A/Delta.md'), '# A Delta\n');
    await writeFile(join(root, 'B/Delta.md'), '# B Delta\n');
    await writeFile(join(root, 'C.md'), 'no links yet\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    await deleteNote(ctx, { path: 'A/Delta.md' });
    // With A/Delta.md gone, [[Delta]] resolves to B/Delta.md, as the watcher would register it.
    await writeFile(join(root, 'C.md'), 'now [[Delta]]\n');
    replaceDoc(ctx, 'C.md', 'now [[Delta]]\n');
    addNoteBacklinks(ctx, 'C.md', 'now [[Delta]]\n');
    expect(getBacklinks(ctx, { path: 'B/Delta.md' }).backlinks.map((b) => b.path)).toEqual([
      'C.md',
    ]);
    const [del] = listWrites(ctx, { path: 'A/Delta.md' }).writes;
    await undoWrite(ctx, { seq: del?.seq });
    await expectInSync();
    expect(getBacklinks(ctx, { path: 'A/Delta.md' }).backlinks.map((b) => b.path)).toEqual([
      'C.md',
    ]);
    expect(getBacklinks(ctx, { path: 'B/Delta.md' }).total).toBe(0);
  });

  it('a returning note leaves the other note the line that still links to it (SHA-572)', async () => {
    await mkdir(join(root, 'B'));
    await writeFile(join(root, 'A/Delta.md'), '# A Delta\n');
    await writeFile(join(root, 'B/Delta.md'), '# B Delta\n');
    await writeFile(join(root, 'C.md'), 'no links yet\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    await deleteNote(ctx, { path: 'A/Delta.md' });
    // With A/Delta.md gone, both lines resolve to B/Delta.md, so its ref records line 1.
    const text = 'now [[Delta]]\nand [[B/Delta.md]]\n';
    await writeFile(join(root, 'C.md'), text);
    replaceDoc(ctx, 'C.md', text);
    addNoteBacklinks(ctx, 'C.md', text);
    expect(ctx.backlinks.get('B/Delta.md')?.map((r) => r.line)).toEqual([1]);
    const [del] = listWrites(ctx, { path: 'A/Delta.md' }).writes;
    await undoWrite(ctx, { seq: del?.seq });
    await expectInSync();
    // Line 1 now resolves to A/Delta.md; B/Delta.md keeps C.md through line 2.
    const fresh = await cold();
    for (const target of ['A/Delta.md', 'B/Delta.md']) {
      expect(ctx.backlinks.get(target)).toEqual(fresh.backlinks.get(target));
    }
    expect(ctx.backlinks.get('B/Delta.md')?.map((r) => r.line)).toEqual([2]);
  });

  // The restore scan skips notes whose text can't name the returning note.
  // Each case links in a way the plain text doesn't spell out.
  const folded = 'rel: "[[Bank\n  Holidays]]"';
  it.each([
    ['a frontmatter link folded across lines', 'Bank Holidays.md', '', `---\n${folded}`],
    ['a folded link after a BOM', 'Bank Holidays.md', '', `﻿---\n${folded}`],
    ['an escaped frontmatter link', 'Omega.md', '', '---\nrel: "[[\\u004Fmega]]"'],
    ['a single-quoted alias', 'Quote.md', 'aliases: ["It\'s"]\n', "---\nrel: '[[It''s]]'"],
    ['a name with a dotted capital I', 'İzmir.md', '', '---\nrel: "[[İZMIR]]"'],
    ['the Kelvin sign', 'kelvin.md', '', '---\nrel: "[[Kelvin]]"'],
    // A line that starts with --- doesn't close the block.
    ['an escape after a ---x line', 'Omega.md', '', '---\n---x: 1\nrel: "[[\\x4Fmega]]"'],
    ['a folded link after a ----: line', 'Bank Holidays.md', '', `---\n----: 1\n${folded}`],
    [
      'a quote after a ---x line',
      'Quote.md',
      'aliases: ["It\'s"]\n',
      "---\n---x: 1\nrel: '[[It''s]]'",
    ],
  ])('a returning note gets a link from %s (SHA-572)', async (_, target, fm, head) => {
    await writeFile(join(root, target), `---\n${fm}---\nbody\n`);
    await writeFile(join(root, 'C.md'), `${head}\n---\nno other links\n`);
    ctx = { ...(await cold()), journal: ctx.journal };
    prime(ctx);
    expect(getBacklinks(ctx, { path: target }).total).toBe(1);
    await deleteNote(ctx, { path: target });
    const [del] = listWrites(ctx, { path: target }).writes;
    await undoWrite(ctx, { seq: del?.seq });
    await expectInSync();
    expect(getBacklinks(ctx, { path: target }).backlinks.map((b) => b.path)).toEqual(['C.md']);
  });

  it('delete_note, restore by moving out of .trash/, then undo each step (SHA-560)', async () => {
    const live = () => [...ctx.notes.keys()].filter((p) => p.toLowerCase().startsWith('.trash'));
    await deleteNote(ctx, { path: 'Gamma.md' });
    await moveNote(ctx, { from: '.trash/Gamma.md', to: 'Gamma.md' });
    await expectInSync();
    expect(vaultStats(ctx).links.resolved).toBe(4);

    // Undo the restore: the note goes back into .trash/ and stays unindexed.
    await undoWrite(ctx, {});
    await expectInSync();
    expect(live()).toEqual([]);
    expect(getBacklinks(ctx, { path: 'Gamma.md' }).total).toBe(0);
    expect(vaultStats(ctx).links.resolved).toBe(1);

    // Undo the delete: the inbound links come back.
    await undoWrite(ctx, {});
    await expectInSync();
    expect(live()).toEqual([]);
    expect(vaultStats(ctx).links.resolved).toBe(4);
  });

  it('move_note without rewriting links keeps refs that still resolve', async () => {
    await mkdir(join(root, 'B'));
    await moveNote(ctx, { from: 'A/Beta.md', to: 'B/Beta.md', rewriteLinks: false });
    await expectInSync();
  });

  it('move_note over a note that had links', async () => {
    await moveNote(ctx, { from: 'A/Beta.md', to: 'Gamma.md', overwrite: true });
    await expectInSync();
  });
});

describe('in-place writes count as modified now', () => {
  const writes: Array<[string, () => Promise<unknown>]> = [
    ['append_note', () => appendNote(ctx, { path: 'A/Beta.md', content: 'more' })],
    ['update_task', () => updateTask(ctx, { path: 'A/Beta.md', line: 5, state: 'x' })],
    ['patch_frontmatter', () => patchFrontmatter(ctx, { path: 'A/Beta.md', patch: { k: 1 } })],
  ];
  for (const [name, write] of writes) {
    it(name, async () => {
      for (const note of ctx.notes.values()) note.mtimeMs = Date.now() - 40 * 86_400_000;
      // Changed by hand, outside the index helpers, so bump by hand too.
      ctx.generation++;
      expect(vaultStats(ctx).modified).toEqual({ d1: 0, d7: 0, d30: 0 });
      await write();
      expect(vaultStats(ctx).modified).toEqual({ d1: 1, d7: 1, d30: 1 });
    });
  }
});

describe('a frontmatter alias change resolves on the next get_links call (SHA-461)', () => {
  it('a new alias resolves, and a removed one stops resolving', async () => {
    await writeFile(join(root, 'Linker.md'), 'See [[Gam]].\n');
    ctx = { ...(await cold()), journal: ctx.journal };
    const target = () => getLinks(ctx, { path: 'Linker.md' }).links[0]?.target;
    expect(target()).toBeUndefined();
    await patchFrontmatter(ctx, { path: 'Gamma.md', patch: { aliases: ['Gam'] } });
    expect(target()).toBe('Gamma.md');
    await patchFrontmatter(ctx, { path: 'Gamma.md', patch: { aliases: null } });
    expect(target()).toBeUndefined();
  });
});
