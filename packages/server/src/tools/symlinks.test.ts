import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog, type AuditRecord } from '../audit.js';
import type { ServerContext } from '../context.js';
import { dispatch, WRITE_TOOLS } from '../dispatch.js';
import { buildIndex } from '../index/build.js';
import { Journal } from '../journal.js';
import { createLogger } from '../log.js';
import { parseWritePolicy } from '../policy.js';

/**
 * SHA-575: Seekstone doesn't follow symlinks below the vault root. Every
 * operation refuses or skips a path that crosses one, whatever the link
 * points at. The PRD's matrix (operation × link kind) is below; each cell is
 * a test in this file or the named one, or N/A with the reason.
 *
 * | Link kind                                  | reads | writes (11 + periodic create) | move/delete link | index & search | watcher | journal |
 * |--------------------------------------------|-------|-------------------------------|------------------|----------------|---------|---------|
 * | folder link out (absolute)                 | here  | here                          | here             | here           | watcher.test | N/A: not a journal path |
 * | folder link out (relative)                 | here  | here                          | here             | here           | watcher.test | N/A |
 * | file link out                              | here  | here                          | here             | here           | watcher.test | N/A |
 * | folder link to another vault folder        | here  | here                          | here             | here           | watcher.test | N/A |
 * | file link to another vault note            | here  | here                          | here             | here           | N/A: same path as file link out | N/A |
 * | link to an ancestor of the vault           | here  | here                          | here             | here           | N/A: same path as folder link out | N/A |
 * | link into .trash/ and .seekstone/          | here  | here                          | here             | here           | N/A: dot folders unwatched | N/A |
 * | .trash itself a link                       | N/A: reads of .trash are not refused by link rules beyond the path check | delete_note here | here | N/A: never indexed | N/A | N/A |
 * | each journal component a link (boot/after) | N/A   | journal-symlinks.test, boot-history.test | N/A | N/A | N/A | journal-symlinks.test, boot-history.test |
 * | chained links                              | here  | here                          | here             | here           | N/A: same check | N/A |
 * | dangling link (folder and file)            | here  | here                          | here             | here           | N/A: nothing to read | N/A |
 * | link loop                                  | here  | here                          | here             | here           | N/A: nothing to read | N/A |
 * | link named x.md pointing at a folder       | here  | here                          | here             | here           | watcher.test | N/A |
 * | non-.md attachment link                    | N/A: read tools read notes | N/A: write tools write notes | N/A | here (attachments) | watcher.test | N/A |
 * | link to a FIFO, and a real FIFO named x.md | N/A: the read tools reach it only through the link check | N/A: write tools refuse the link | N/A | watcher-symlinks.test (boot index) | watcher-symlinks.test (not on Windows, which has no FIFOs) | N/A |
 * | new file under a linked folder, missing subfolders | N/A | here                  | N/A              | N/A            | N/A     | N/A |
 * | rename destination that is a link          | N/A   | here (move_note to)           | here             | N/A            | N/A     | N/A |
 * | scoped read path whose base is a link      | N/A   | N/A                           | N/A              | index-symlinks.test | N/A | N/A |
 * | dot folder swapped for a link              | here (index shortcut) | N/A           | N/A              | N/A            | N/A: dot folders unwatched | N/A |
 * | vault root reached through a link          | here  | here                          | N/A              | here           | watcher.test (existing tmpdir on macOS) | N/A |
 * | different letter case                      | here  | here                          | N/A              | N/A            | N/A     | N/A |
 * | NTFS ::$INDEX_ALLOCATION                    | here  | here                          | N/A              | N/A            | N/A     | N/A |
 * | 8.3 short name                             | N/A: a short name can't be created reliably in a test; it resolves to the same directory entry as the long name, which `lstat` sees as the same link | | | | | |
 */

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
const OUT_TEXT = 'outside-the-vault marker';
const LINK_MSG = /goes through a symlink, and Seekstone doesn't follow symlinks\.$/;
const WRITE_LINK_MSG =
  /^Error: Write not permitted: ".*" goes through a symlink, and Seekstone doesn't follow symlinks\.$/;

function linkDir(target: string, path: string): void {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
}

let base: string;
let vault: string;
let outside: string;
let auditPath: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'seekstone-symlinks-'));
  vault = join(base, 'vault');
  outside = join(base, 'outside');
  auditPath = join(base, 'audit.jsonl');
  const put = (abs: string, body: string) => {
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body, 'utf8');
  };
  put(join(vault, 'notes', 'a.md'), '# A\n\n## Out\n\n- [ ] task\n\nSee [[b]].\n');
  put(join(vault, 'notes', 'b.md'), '# B\n');
  put(join(vault, '.trash', 'Old.md'), '# Old\n');
  put(join(outside, 'o.md'), `# Out\n\n## Out\n\n${OUT_TEXT}\n\n- [ ] task\n`);
  put(join(outside, 'sub', 'deep.md'), `# Deep\n\n${OUT_TEXT}\n`);
  put(join(outside, 'pic.png'), 'png');

  linkDir(outside, join(vault, 'ext')); // absolute, out of the vault
  linkDir(join('..', '..', 'outside'), join(vault, 'notes', 'rel-ext')); // relative, out
  linkDir(join(vault, 'notes'), join(vault, 'inner')); // to another vault folder
  linkDir(base, join(vault, 'up')); // to an ancestor of the vault
  linkDir(join(vault, '.trash'), join(vault, 'notes', 'trashlink')); // into .trash
  linkDir(join(vault, 'inner'), join(vault, 'chain')); // link → link → folder
  linkDir(join(base, 'missing'), join(vault, 'dead')); // dangling folder link
  linkDir(join(vault, 'notes'), join(vault, 'dirlink.md')); // a link named x.md, to a folder
  symlinkSync(join(outside, 'o.md'), join(vault, 'outfile.md'), 'file'); // file link out
  symlinkSync(join(vault, 'notes', 'a.md'), join(vault, 'notes', 'inlink.md'), 'file'); // file link in
  symlinkSync(join(base, 'nope.md'), join(vault, 'deadfile.md'), 'file'); // dangling file link
  symlinkSync(join(vault, 'loop-b.md'), join(vault, 'loop-a.md'), 'file'); // loop
  symlinkSync(join(vault, 'loop-a.md'), join(vault, 'loop-b.md'), 'file');
  symlinkSync(join(outside, 'pic.png'), join(vault, 'pic.png'), 'file'); // attachment link
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function makeCtx(
  env: Record<string, string> = {},
  root: string = vault,
): Promise<ServerContext> {
  const journal = await Journal.open(root, { maxBytes: 1e9, maxEntries: 1e6 });
  if (!existsSync(join(vault, 'notes', 'histlink'))) {
    linkDir(join(vault, '.seekstone'), join(vault, 'notes', 'histlink')); // into .seekstone
  }
  const policy = parseWritePolicy(env);
  const scope = policy.readGlobs ? { include: policy.readGlobs, exclude: [] } : undefined;
  const built = await buildIndex(root, scope);
  return {
    vaultRoot: root,
    index: built.index,
    notes: built.notes,
    generation: 0,
    backlinks: built.backlinks,
    attachments: built.attachments,
    policy,
    journal,
    audit: AuditLog.open({ path: auditPath, maxBytes: 1e9 }),
  };
}

async function call(ctx: ServerContext, tool: string, args: Record<string, unknown>) {
  const r = await dispatch(ctx, tool, args, log);
  return { isError: r.isError === true, text: r.content.map((c) => c.text).join('\n') };
}

async function records(): Promise<AuditRecord[]> {
  const raw = await readFile(auditPath, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as AuditRecord);
}

/** Paths that cross a link, one per link kind in the matrix. */
const LINKED_PATHS: [string, string][] = [
  ['folder link out (absolute)', 'ext/o.md'],
  ['folder link out (relative)', 'notes/rel-ext/o.md'],
  ['link in an intermediate folder', 'notes/rel-ext/sub/deep.md'],
  ['file link out', 'outfile.md'],
  ['folder link to another vault folder', 'inner/a.md'],
  ['file link to another vault note', 'notes/inlink.md'],
  ['link to an ancestor of the vault', 'up/vault/notes/a.md'],
  ['link into .trash/', 'notes/trashlink/Old.md'],
  ['link into .seekstone/', 'notes/histlink/history/manifest.jsonl'],
  ['chained links', 'chain/a.md'],
  ['dangling folder link', 'dead/x.md'],
  ['dangling file link', 'deadfile.md'],
  ['link loop', 'loop-a.md'],
  ['link named x.md pointing at a folder', 'dirlink.md'],
];

/** Tool name → args that write to `p`. */
const writeCalls: [string, (p: string) => Record<string, unknown>][] = [
  ['create_note', (p) => ({ path: p, content: 'x', overwrite: true })],
  ['delete_note', (p) => ({ path: p })],
  ['delete_note (permanent)', (p) => ({ path: p, permanent: true })],
  ['move_note (from)', (p) => ({ from: p, to: 'notes/moved.md' })],
  ['move_note (to)', (p) => ({ from: 'notes/b.md', to: p, overwrite: true })],
  ['rename_heading', (p) => ({ path: p, oldHeading: 'Out', newHeading: 'New' })],
  ['append_note', (p) => ({ path: p, content: 'x' })],
  ['patch_frontmatter', (p) => ({ path: p, patch: { a: 1 } })],
  [
    'patch_note',
    (p) => ({ path: p, target: { heading: 'Out' }, operation: 'append', content: 'x' }),
  ],
  ['replace_in_note', (p) => ({ path: p, find: 'Out', replace: 'New' })],
  ['update_task', (p) => ({ path: p, line: 5, state: 'x' })],
];

describe('reads through a symlink', () => {
  it.each(LINKED_PATHS)('refuses %s for every read tool', async (_kind, path) => {
    const ctx = await makeCtx();
    for (const tool of ['read_note', 'outline_note']) {
      const r = await call(ctx, tool, { path });
      expect(r.isError, `${tool} ${path}`).toBe(true);
      expect(r.text, `${tool} ${path}`).toMatch(LINK_MSG);
      expect(r.text).not.toContain(OUT_TEXT);
    }
    const many = await call(ctx, 'read_notes', { items: [{ path }] });
    const parsed = JSON.parse(many.text) as { notes: { error?: string }[] };
    expect(parsed.notes[0]?.error, path).toBe('symlink');
  });

  it('gives the same message whether or not the link target exists', async () => {
    const ctx = await makeCtx();
    const a = await call(ctx, 'read_note', { path: 'dead/x.md' });
    const b = await call(ctx, 'read_note', { path: 'ext/x.md' });
    expect(a.text.replace('dead', 'ext')).toBe(b.text);
  });

  it('hides a path outside the read scope as not found, even through a link', async () => {
    const ctx = await makeCtx({ SEEKSTONE_READ_PATHS: 'notes/*.md' });
    const r = await call(ctx, 'read_note', { path: 'ext/o.md' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/ENOENT/);
    expect(r.text).not.toMatch(/goes through a symlink/);
  });

  it('refuses a case variant and an NTFS stream name of a linked folder', async () => {
    const ctx = await makeCtx();
    for (const path of ['EXT/o.md', 'Ext/o.md', 'ext::$INDEX_ALLOCATION/o.md']) {
      const r = await call(ctx, 'read_note', { path });
      expect(r.isError, path).toBe(true);
      expect(r.text, path).not.toContain(OUT_TEXT);
    }
  });

  it('reads an ordinary note', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'notes/a.md' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('# A');
  });

  it('works when the vault root itself is reached through a link', async () => {
    const alias = join(base, 'alias');
    linkDir(vault, alias);
    const ctx = await makeCtx({}, alias);
    expect((await call(ctx, 'read_note', { path: 'notes/a.md' })).isError).toBe(false);
    const w = await call(ctx, 'append_note', { path: 'notes/a.md', content: 'more' });
    expect(w.isError, w.text).toBe(false);
    expect(ctx.notes.has('notes/a.md')).toBe(true);
    expect((await call(ctx, 'read_note', { path: 'ext/o.md' })).isError).toBe(true);
  });

  it('skips the index shortcut for a dot folder swapped for a link', async () => {
    mkdirSync(join(vault, '.drafts'));
    writeFileSync(join(vault, '.drafts', 'd.md'), '# D\n');
    const ctx = await makeCtx();
    expect(ctx.notes.has('.drafts/d.md')).toBe(true);
    rmSync(join(vault, '.drafts'), { recursive: true });
    mkdirSync(join(outside, 'drafts'));
    writeFileSync(join(outside, 'drafts', 'd.md'), OUT_TEXT);
    linkDir(join(outside, 'drafts'), join(vault, '.drafts'));
    const r = await call(ctx, 'read_note', { path: '.drafts/d.md' });
    expect(r.isError).toBe(true);
    expect(r.text).not.toContain(OUT_TEXT);
  });
});

describe('writes through a symlink', () => {
  it('covers every write tool that takes a path', () => {
    const covered = new Set(writeCalls.map(([name]) => name.split(' ')[0]));
    const computed = new Set(['undo_write', 'append_periodic_note']); // tested below
    expect([...WRITE_TOOLS].filter((t) => !covered.has(t) && !computed.has(t))).toEqual([]);
  });

  it.each(LINKED_PATHS)('refuses %s for every write tool and changes nothing', async (_k, path) => {
    const ctx = await makeCtx();
    const outBefore = await readFile(join(outside, 'o.md'), 'utf8');
    const aBefore = await readFile(join(vault, 'notes', 'a.md'), 'utf8');
    const seqBefore = ctx.journal?.lastSeq;
    for (const [label, args] of writeCalls) {
      const tool = label.split(' ')[0] ?? label;
      const r = await call(ctx, tool, args(path));
      expect(r.isError, `${label} ${path}`).toBe(true);
      expect(r.text, `${label} ${path}`).toMatch(WRITE_LINK_MSG);
    }
    expect(await readFile(join(outside, 'o.md'), 'utf8')).toBe(outBefore);
    expect(await readFile(join(vault, 'notes', 'a.md'), 'utf8')).toBe(aBefore);
    expect(ctx.journal?.lastSeq).toBe(seqBefore);
    const recs = await records();
    expect(recs.length).toBe(writeCalls.length);
    for (const rec of recs) {
      expect(rec.outcome).toBe('policy_denied');
      expect(rec.policy).toBe('symlink');
    }
  });

  it('refuses a new file under a linked folder whose subfolders do not exist yet', async () => {
    const ctx = await makeCtx();
    for (const path of ['ext/new.md', 'ext/fresh/dir/new.md', 'inner/fresh/new.md']) {
      const r = await call(ctx, 'create_note', { path, content: 'x' });
      expect(r.text, path).toMatch(WRITE_LINK_MSG);
    }
    expect(existsSync(join(outside, 'new.md'))).toBe(false);
    expect(existsSync(join(outside, 'fresh'))).toBe(false);
    expect(existsSync(join(vault, 'notes', 'fresh'))).toBe(false);
  });

  it('refuses case variants and NTFS stream names of a linked folder', async () => {
    const ctx = await makeCtx();
    const before = await readFile(join(outside, 'o.md'), 'utf8');
    for (const path of ['EXT/o.md', 'ext::$INDEX_ALLOCATION/o.md']) {
      const r = await call(ctx, 'append_note', { path, content: 'x' });
      expect(r.isError, path).toBe(true);
    }
    expect(await readFile(join(outside, 'o.md'), 'utf8')).toBe(before);
  });

  it('classifies a quoted path that contains the message text by the real ending', async () => {
    const ctx = await makeCtx({ SEEKSTONE_WRITE_PATHS: 'notes/**' });
    const tricky = "x goes through a symlink, and Seekstone doesn't follow symlinks.md";
    const r = await call(ctx, 'create_note', { path: tricky, content: 'x' });
    expect(r.isError).toBe(true);
    const [rec] = await records();
    expect(rec?.policy).toBe('write_paths');
  });

  it('writes an ordinary note', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'append_note', { path: 'notes/a.md', content: 'more' });
    expect(r.isError, r.text).toBe(false);
  });
});

describe('notes a move or heading rename rewrites', () => {
  it('skips a linker whose folder became a link, and lists it', async () => {
    writeFileSync(join(vault, 'notes', 'linker.md'), 'See [[b]].\n');
    mkdirSync(join(vault, 'other'));
    writeFileSync(join(vault, 'other', 'l2.md'), 'See [[b]].\n');
    const ctx = await makeCtx();
    // Swap the cached linker's folder for a link to an outside copy.
    rmSync(join(vault, 'other'), { recursive: true });
    mkdirSync(join(outside, 'other'));
    writeFileSync(join(outside, 'other', 'l2.md'), 'See [[b]].\n');
    linkDir(join(outside, 'other'), join(vault, 'other'));
    const r = await call(ctx, 'move_note', { from: 'notes/b.md', to: 'notes/c.md' });
    expect(r.isError, r.text).toBe(false);
    expect(r.text).toMatch(/Skipped \(not writable[^)]*\): other\/l2\.md/);
    expect(await readFile(join(outside, 'other', 'l2.md'), 'utf8')).toBe('See [[b]].\n');
    expect(await readFile(join(vault, 'notes', 'linker.md'), 'utf8')).toContain('[[c]]');
  });
});

describe('undo_write and periodic notes', () => {
  it('refuses to undo onto a path whose folder became a link, before changing anything', async () => {
    mkdirSync(join(vault, 'proj'));
    const ctx = await makeCtx();
    expect((await call(ctx, 'create_note', { path: 'proj/n.md', content: 'x' })).isError).toBe(
      false,
    );
    rmSync(join(vault, 'proj'), { recursive: true });
    mkdirSync(join(outside, 'proj'));
    writeFileSync(join(outside, 'proj', 'n.md'), OUT_TEXT);
    linkDir(join(outside, 'proj'), join(vault, 'proj'));
    const r = await call(ctx, 'undo_write', {});
    expect(r.text).toMatch(WRITE_LINK_MSG);
    expect(await readFile(join(outside, 'proj', 'n.md'), 'utf8')).toBe(OUT_TEXT);
  });

  it('refuses periodic notes in a linked daily folder, and probes them as missing', async () => {
    mkdirSync(join(vault, '.obsidian'));
    writeFileSync(
      join(vault, '.obsidian', 'daily-notes.json'),
      JSON.stringify({ folder: 'ext', format: 'YYYY-MM-DD' }),
    );
    writeFileSync(join(outside, '2026-01-02.md'), OUT_TEXT);
    const ctx = await makeCtx();
    const probe = await call(ctx, 'get_periodic_note', { date: '2026-01-02' });
    expect(JSON.parse(probe.text).existed).toBe(false);
    const create = await call(ctx, 'get_periodic_note', {
      date: '2026-01-03',
      createIfMissing: true,
    });
    expect(create.text).toMatch(WRITE_LINK_MSG);
    const append = await call(ctx, 'append_periodic_note', { date: '2026-01-02', content: 'x' });
    expect(append.text).toMatch(WRITE_LINK_MSG);
    expect(await readFile(join(outside, '2026-01-02.md'), 'utf8')).toBe(OUT_TEXT);
    expect(existsSync(join(outside, '2026-01-03.md'))).toBe(false);
  });

  it('reads settings through a linked .obsidian, and skips a linked template with a warning', async () => {
    mkdirSync(join(outside, 'cfg'));
    writeFileSync(
      join(outside, 'cfg', 'daily-notes.json'),
      JSON.stringify({ folder: 'daily', format: 'YYYY-MM-DD', template: 'ext/tpl' }),
    );
    writeFileSync(join(outside, 'tpl.md'), OUT_TEXT);
    linkDir(join(outside, 'cfg'), join(vault, '.obsidian'));
    const ctx = await makeCtx();
    const r = await call(ctx, 'get_periodic_note', { date: '2026-01-02', createIfMissing: true });
    expect(r.isError, r.text).toBe(false);
    expect(r.text).toContain('"path": "daily/2026-01-02.md"');
    expect(r.text.split('\n').at(-1)).toBe(
      'Template "ext/tpl.md" was skipped because it goes through a symlink.',
    );
    expect(await readFile(join(vault, 'daily', '2026-01-02.md'), 'utf8')).toBe('');
  });

  it('treats a settings file that is not a regular file, or is over 1 MB, as missing', async () => {
    mkdirSync(join(vault, '.obsidian'));
    // A folder where the file should be.
    mkdirSync(join(vault, '.obsidian', 'daily-notes.json'));
    const ctx = await makeCtx();
    const r = await call(ctx, 'get_periodic_note', { date: '2026-01-02' });
    expect(JSON.parse(r.text).path).toBe('2026-01-02.md');
    rmSync(join(vault, '.obsidian', 'daily-notes.json'), { recursive: true });
    const big = JSON.stringify({ folder: 'big', format: 'YYYY-MM-DD', pad: 'x'.repeat(1_100_000) });
    writeFileSync(join(vault, '.obsidian', 'daily-notes.json'), big);
    const r2 = await call(ctx, 'get_periodic_note', { date: '2026-01-02' });
    expect(JSON.parse(r2.text).path).toBe('2026-01-02.md');
  });
});

describe('.trash as a link', () => {
  it('refuses a recoverable delete with no journal entry, and allows a permanent one', async () => {
    rmSync(join(vault, '.trash'), { recursive: true });
    mkdirSync(join(outside, 'trash'));
    linkDir(join(outside, 'trash'), join(vault, '.trash'));
    const ctx = await makeCtx();
    const seq = ctx.journal?.lastSeq;
    const r = await call(ctx, 'delete_note', { path: 'notes/b.md' });
    expect(r.text).toBe(
      "Error: Delete not permitted: .trash/ is a symlink, and Seekstone doesn't follow symlinks. Pass permanent: true to delete without recovery.",
    );
    expect(ctx.journal?.lastSeq).toBe(seq);
    expect(existsSync(join(vault, 'notes', 'b.md'))).toBe(true);
    const [rec] = await records();
    expect(rec?.policy).toBe('symlink');
    const p = await call(ctx, 'delete_note', { path: 'notes/b.md', permanent: true });
    expect(p.isError, p.text).toBe(false);
    expect(existsSync(join(vault, 'notes', 'b.md'))).toBe(false);
  });

  it('never overwrites a link sitting at a .trash candidate name', async () => {
    // Dangling: `access` (which follows links) reports the name as free, so a
    // rename would replace the link. `lstat` sees it as taken.
    symlinkSync(join(outside, 'gone.md'), join(vault, '.trash', 'b.md'), 'file');
    const ctx = await makeCtx();
    const r = await call(ctx, 'delete_note', { path: 'notes/b.md' });
    expect(r.isError, r.text).toBe(false);
    expect(lstatSync(join(vault, '.trash', 'b.md')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(outside, 'gone.md'))).toBe(false);
  });
});

describe('index and search', () => {
  it('indexes no note or attachment reached through a link', async () => {
    const ctx = await makeCtx();
    const keys = [...ctx.notes.keys()];
    expect(keys.sort()).toEqual(['notes/a.md', 'notes/b.md']);
    expect([...ctx.attachments.byPath.keys()]).toEqual([]);
    const s = await call(ctx, 'search', { query: 'outside' });
    expect(s.text).not.toContain(OUT_TEXT);
  });
});
