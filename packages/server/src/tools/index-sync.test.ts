import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { Journal } from '../journal.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from './append_note.js';
import { createNote } from './create_note.js';
import { deleteNote } from './delete_note.js';
import { moveNote } from './move_note.js';
import { patchFrontmatter } from './patch_frontmatter.js';
import { patchNote } from './patch_note.js';
import { appendPeriodicNote } from './periodic_note.js';
import { replaceInNote } from './replace_in_note.js';
import { undoWrite } from './undo_write.js';
import { updateTask } from './update_task.js';
import { vaultStats } from './vault_stats.js';

// Every write tool updates the in-memory index itself, so vault_stats and
// get_backlinks must match a cold rebuild right after the call, with no
// watcher running. Link additions are left to the watcher by design, so
// these cases add no new links.

let root: string;
let ctx: ServerContext;

async function cold(): Promise<ServerContext> {
  return { ...(await buildIndex(root)), vaultRoot: root, policy: PERMISSIVE_POLICY };
}

/** target → sorted source paths, for targets that are live notes. */
function linkSets(c: ServerContext): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [target, refs] of c.backlinks) {
    if (c.notes.has(target) && refs.length > 0) out[target] = refs.map((r) => r.path).sort();
  }
  return out;
}

async function expectInSync(): Promise<void> {
  const fresh = await cold();
  expect(vaultStats(ctx)).toEqual(vaultStats(fresh));
  expect(linkSets(ctx)).toEqual(linkSets(fresh));
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
  ctx = await cold();
  ctx.journal = await Journal.open(root, { maxBytes: 1e9, maxEntries: 1e6 });
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
      expect(vaultStats(ctx).modified).toEqual({ d1: 0, d7: 0, d30: 0 });
      await write();
      expect(vaultStats(ctx).modified).toEqual({ d1: 1, d7: 1, d30: 1 });
    });
  }
});
