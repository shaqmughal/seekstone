import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog, type AuditRecord } from '../audit.js';
import type { ServerContext } from '../context.js';
import { dispatch, WRITE_TOOLS } from '../dispatch.js';
import { buildIndex } from '../index/build.js';
import { HISTORY_DIR, Journal } from '../journal.js';
import { createLogger } from '../log.js';
import { PERMISSIVE_POLICY } from '../policy.js';

/**
 * SHA-560: no write tool may touch `.seekstone/` (the write journal) or
 * `.trash/` (deleted notes), whatever spelling of the path reaches it. The one
 * exception is `move_note`'s source inside `.trash/`: moving a trashed note
 * back out is how it is restored.
 */

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
const MANIFEST = `${HISTORY_DIR}/manifest.jsonl`;
const TRASHED = '.trash/Old.md';

let vault: string;
let auditPath: string;
let ctx: ServerContext;

async function records(): Promise<AuditRecord[]> {
  const raw = await readFile(auditPath, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as AuditRecord);
}

/** Every file under the two reserved folders, path → bytes. */
async function reservedSnapshot(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const dir of ['.seekstone', '.trash']) {
    const entries = await readdir(join(vault, dir), { recursive: true, withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const abs = join(e.parentPath, e.name);
      out.set(abs, await readFile(abs, 'utf8'));
    }
  }
  return out;
}

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-reserved-'));
  auditPath = `${vault}-audit.jsonl`;
  await writeFile(join(vault, 'Alpha.md'), '# Alpha\n\n- [ ] task\n', 'utf8');
  await mkdir(join(vault, '.trash'));
  await writeFile(join(vault, TRASHED), '# Old\n\n- [ ] task\n', 'utf8');
  const built = await buildIndex(vault);
  ctx = {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    backlinks: built.backlinks,
    attachments: built.attachments,
    policy: PERMISSIVE_POLICY,
    journal: await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 }),
    audit: AuditLog.open({ path: auditPath, maxBytes: 1e9 }),
  };
  // One real write so the manifest exists and has content to protect.
  const ok = await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'more' }, log);
  expect(ok.isError).toBeFalsy();
  await rm(auditPath);
  ctx.audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
  await rm(auditPath, { force: true });
});

describe('create_note into the write history (SHA-560)', () => {
  it('is refused and leaves the manifest unchanged', async () => {
    const before = await readFile(join(vault, MANIFEST), 'utf8');
    const r = await dispatch(
      ctx,
      'create_note',
      { path: MANIFEST, content: 'forged', overwrite: true },
      log,
    );
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toBe(
      `Error: Write not permitted: "${MANIFEST}" is inside .seekstone/, which Seekstone reserves for write history and deleted notes.`,
    );
    expect(await readFile(join(vault, MANIFEST), 'utf8')).toBe(before);
  });
});

describe('every write tool refuses reserved targets', () => {
  /** Spellings of a path inside each reserved folder. */
  const variants = (file: string): [string, string][] => [
    ['plain', `.seekstone/${file}`],
    ['dot-dot', `notes/../.seekstone/${file}`],
    ['dot-slash, mixed case', `./.Seekstone/${file}`],
    ['upper case', `.TRASH/${file}`],
    ['backslashes', `.trash\\${file}`],
    ['trailing dot', `.trash./${file}`],
    ['absolute', join(vault, '.trash', file)],
  ];

  /** Tool name → args aimed at `p`. */
  const calls: [string, (p: string) => Record<string, unknown>][] = [
    ['create_note', (p) => ({ path: p, content: 'x', overwrite: true })],
    ['delete_note', (p) => ({ path: p })],
    ['delete_note (permanent)', (p) => ({ path: p, permanent: true })],
    ['move_note (from)', (p) => ({ from: p, to: 'Moved.md' })],
    ['move_note (to)', (p) => ({ from: 'Alpha.md', to: p, overwrite: true })],
    ['rename_heading', (p) => ({ path: p, oldHeading: 'Old', newHeading: 'New' })],
    ['append_note', (p) => ({ path: p, content: 'x' })],
    ['patch_frontmatter', (p) => ({ path: p, patch: { a: 1 } })],
    [
      'patch_note',
      (p) => ({ path: p, target: { heading: 'Old' }, operation: 'append', content: 'x' }),
    ],
    ['replace_in_note', (p) => ({ path: p, find: 'Old', replace: 'New' })],
    ['update_task', (p) => ({ path: p, line: 3, state: 'x' })],
  ];

  it('covers every write tool that takes a path', () => {
    const covered = new Set(calls.map(([name]) => name.split(' ')[0]));
    // undo_write and append_periodic_note compute their paths; tested below.
    const computed = new Set(['undo_write', 'append_periodic_note']);
    expect([...WRITE_TOOLS].filter((t) => !covered.has(t) && !computed.has(t))).toEqual([]);
  });

  it('refuses each tool × path spelling with policy_denied and changes nothing', async () => {
    const cases = calls
      .flatMap(([label, args]) =>
        variants('Old.md').map(([how, p]) => ({
          label,
          how,
          tool: label.split(' ')[0] ?? label,
          args: args(p),
        })),
      )
      .filter(
        // move_note may take its source from .trash/ (restore); tested below.
        (c) => !(c.label === 'move_note (from)' && /trash/i.test(String(c.args.from))),
      );
    const before = await reservedSnapshot();
    const alpha = await readFile(join(vault, 'Alpha.md'), 'utf8');
    for (const c of cases) {
      const r = await dispatch(ctx, c.tool, c.args, log);
      expect(r.isError, `${c.label} / ${c.how}`).toBe(true);
      expect(r.content[0]?.text, `${c.label} / ${c.how}`).toMatch(
        /^Error: Write not permitted: ".*" is inside \.(seekstone|trash)\/, which Seekstone reserves/,
      );
    }
    expect(await reservedSnapshot()).toEqual(before);
    expect(await readFile(join(vault, 'Alpha.md'), 'utf8')).toBe(alpha);
    await expect(access(join(vault, 'Moved.md'))).rejects.toThrow();

    const recs = await records();
    expect(recs).toHaveLength(cases.length);
    for (const r of recs) {
      expect(r).toMatchObject({
        outcome: 'policy_denied',
        policy: 'reserved_path',
        error: 'reserved_path',
      });
    }
  });

  it('refuses append_periodic_note and get_periodic_note when the folder is reserved', async () => {
    await mkdir(join(vault, '.obsidian'));
    await writeFile(
      join(vault, '.obsidian', 'daily-notes.json'),
      JSON.stringify({ folder: '.Seekstone/history' }),
      'utf8',
    );
    const args = { period: 'daily', date: '2026-01-03' };
    const append = await dispatch(ctx, 'append_periodic_note', { ...args, content: 'x' }, log);
    const get = await dispatch(ctx, 'get_periodic_note', { ...args, createIfMissing: true }, log);
    for (const r of [append, get]) {
      expect(r.isError).toBe(true);
      expect(r.content[0]?.text).toMatch(/is inside \.seekstone\/, which Seekstone reserves/);
    }
    await expect(access(join(vault, '.seekstone', 'history', '2026-01-03.md'))).rejects.toThrow();
    expect((await records()).map((r) => [r.tool, r.policy])).toEqual([
      ['append_periodic_note', 'reserved_path'],
      ['get_periodic_note', 'reserved_path'],
    ]);
  });

  it('refuses undo_write when a journal entry names a .seekstone/ path', async () => {
    const journal = ctx.journal as Journal;
    const before = await readFile(join(vault, MANIFEST), 'utf8');
    const txn = journal.begin('create_note');
    await txn.add('.seekstone/forged.md', null, 'forged');
    await txn.commit();
    await writeFile(join(vault, '.seekstone', 'forged.md'), 'forged', 'utf8');
    const r = await dispatch(ctx, 'undo_write', {}, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/"\.seekstone\/forged\.md" is inside \.seekstone\//);
    expect(await readFile(join(vault, '.seekstone', 'forged.md'), 'utf8')).toBe('forged');
    expect((await readFile(join(vault, MANIFEST), 'utf8')).startsWith(before)).toBe(true);
    expect((await records()).map((r) => [r.tool, r.outcome, r.policy])).toEqual([
      ['undo_write', 'policy_denied', 'reserved_path'],
    ]);
  });

  it('lets undo_write write a .trash/ path named by the journal entry', async () => {
    const journal = ctx.journal as Journal;
    const txn = journal.begin('create_note');
    await txn.add(TRASHED, '# Old\n\n- [ ] task\n', 'changed');
    await txn.commit();
    await writeFile(join(vault, TRASHED), 'changed', 'utf8');
    const r = await dispatch(ctx, 'undo_write', {}, log);
    expect(r.isError, r.content[0]?.text).toBeFalsy();
    expect(await readFile(join(vault, TRASHED), 'utf8')).toBe('# Old\n\n- [ ] task\n');
  });
});

describe('move_note restores a note out of .trash/', () => {
  it.each([
    ['plain', TRASHED],
    ['mixed case', '.Trash/Old.md'],
    ['dot-dot', 'notes/../.trash/Old.md'],
  ])('accepts a .trash/ source (%s) and journals the restore', async (_how, from) => {
    // Put the note at the requested spelling: on a case-sensitive file system
    // `.Trash/` is a different folder from `.trash/`, and it is reserved too.
    await mkdir(dirname(join(vault, from)), { recursive: true });
    await writeFile(join(vault, from), '# Old\n\n- [ ] task\n', 'utf8');
    const r = await dispatch(ctx, 'move_note', { from, to: 'Old.md' }, log);
    expect(r.isError, r.content[0]?.text).toBeFalsy();
    expect(await readFile(join(vault, 'Old.md'), 'utf8')).toBe('# Old\n\n- [ ] task\n');
    await expect(access(join(vault, from))).rejects.toThrow();
    expect(ctx.notes.has('Old.md')).toBe(true);
    expect((await records()).map((rec) => [rec.tool, rec.outcome])).toEqual([['move_note', 'ok']]);
  });

  it('accepts an absolute .trash/ source', async () => {
    const from = join(vault, '.trash', 'Old.md');
    const r = await dispatch(ctx, 'move_note', { from, to: 'Old.md' }, log);
    expect(r.isError, r.content[0]?.text).toBeFalsy();
    expect(await readFile(join(vault, 'Old.md'), 'utf8')).toBe('# Old\n\n- [ ] task\n');
  });

  it('round-trips delete_note then move_note back to the original path', async () => {
    const original = await readFile(join(vault, 'Alpha.md'), 'utf8');
    const del = await dispatch(ctx, 'delete_note', { path: 'Alpha.md' }, log);
    expect(del.isError).toBeFalsy();
    const back = await dispatch(ctx, 'move_note', { from: '.trash/Alpha.md', to: 'Alpha.md' }, log);
    expect(back.isError, back.content[0]?.text).toBeFalsy();
    expect(await readFile(join(vault, 'Alpha.md'), 'utf8')).toBe(original);
    await expect(access(join(vault, '.trash', 'Alpha.md'))).rejects.toThrow();
  });

  it('still refuses .trash/ as the destination of a move out of .trash/', async () => {
    const r = await dispatch(ctx, 'move_note', { from: TRASHED, to: '.trash/Other.md' }, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/"\.trash\/Other\.md" is inside \.trash\//);
    expect(await readFile(join(vault, TRASHED), 'utf8')).toBe('# Old\n\n- [ ] task\n');
    await expect(access(join(vault, '.trash', 'Other.md'))).rejects.toThrow();
  });

  it('refuses .seekstone/ as the source', async () => {
    const before = await readFile(join(vault, MANIFEST), 'utf8');
    const r = await dispatch(ctx, 'move_note', { from: MANIFEST, to: 'stolen.jsonl' }, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/is inside \.seekstone\//);
    expect(await readFile(join(vault, MANIFEST), 'utf8')).toBe(before);
    await expect(access(join(vault, 'stolen.jsonl'))).rejects.toThrow();
    expect((await records()).map((rec) => [rec.outcome, rec.policy])).toEqual([
      ['policy_denied', 'reserved_path'],
    ]);
  });

  it('still applies read-only mode and SEEKSTONE_WRITE_PATHS to a .trash/ source', async () => {
    ctx.policy = { ...PERMISSIVE_POLICY, writeGlobs: ['notes/**'] };
    const r = await dispatch(ctx, 'move_note', { from: TRASHED, to: 'notes/Old.md' }, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/outside SEEKSTONE_WRITE_PATHS/);
    expect(await readFile(join(vault, TRASHED), 'utf8')).toBe('# Old\n\n- [ ] task\n');
  });

  it('undo_write of a restore puts the note back in .trash/, and the next undo reverses the delete', async () => {
    const original = await readFile(join(vault, 'Alpha.md'), 'utf8');
    const trashed = join(vault, '.trash', 'Alpha.md');
    expect((await dispatch(ctx, 'delete_note', { path: 'Alpha.md' }, log)).isError).toBeFalsy();
    const back = await dispatch(ctx, 'move_note', { from: '.trash/Alpha.md', to: 'Alpha.md' }, log);
    expect(back.isError, back.content[0]?.text).toBeFalsy();

    // Undo the restore: the note goes back into .trash/.
    const undo1 = await dispatch(ctx, 'undo_write', {}, log);
    expect(undo1.isError, undo1.content[0]?.text).toBeFalsy();
    expect(await readFile(trashed, 'utf8')).toBe(original);
    await expect(access(join(vault, 'Alpha.md'))).rejects.toThrow();
    // The trashed note stays out of the live index, like the walker leaves it.
    expect([...ctx.notes.keys()].filter((p) => /trash/i.test(p))).toEqual([]);
    expect(ctx.notes.has('Alpha.md')).toBe(false);
    const sources = [...ctx.backlinks.values()].flat().map((ref) => ref.path);
    expect(sources.filter((p) => /trash|^Alpha\.md$/i.test(p))).toEqual([]);

    // The next default undo walks back to the delete and restores the note.
    const undo2 = await dispatch(ctx, 'undo_write', {}, log);
    expect(undo2.isError, undo2.content[0]?.text).toBeFalsy();
    expect(await readFile(join(vault, 'Alpha.md'), 'utf8')).toBe(original);
    expect(ctx.notes.has('Alpha.md')).toBe(true);
    expect((await records()).map((rec) => [rec.tool, rec.outcome])).toEqual([
      ['delete_note', 'ok'],
      ['move_note', 'ok'],
      ['undo_write', 'ok'],
      ['undo_write', 'ok'],
    ]);
  });

  it('still refuses an agent-supplied .trash/ path after an undo into .trash/', async () => {
    await dispatch(ctx, 'move_note', { from: TRASHED, to: 'Old.md' }, log);
    expect((await dispatch(ctx, 'undo_write', {}, log)).isError).toBeFalsy();
    const r = await dispatch(ctx, 'append_note', { path: TRASHED, content: 'x' }, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/is inside \.trash\//);
    expect(await readFile(join(vault, TRASHED), 'utf8')).toBe('# Old\n\n- [ ] task\n');
  });
});

describe('the delete_note → .trash/ → undo_write round trip still works', () => {
  it('moves the note into .trash/ and undo_write restores it', async () => {
    const original = await readFile(join(vault, 'Alpha.md'), 'utf8');
    const del = await dispatch(ctx, 'delete_note', { path: 'Alpha.md' }, log);
    expect(del.isError).toBeFalsy();
    expect(await readFile(join(vault, '.trash', 'Alpha.md'), 'utf8')).toBe(original);
    await expect(access(join(vault, 'Alpha.md'))).rejects.toThrow();

    const undo = await dispatch(ctx, 'undo_write', {}, log);
    expect(undo.isError).toBeFalsy();
    expect(await readFile(join(vault, 'Alpha.md'), 'utf8')).toBe(original);
    expect((await records()).map((r) => [r.tool, r.outcome])).toEqual([
      ['delete_note', 'ok'],
      ['undo_write', 'ok'],
    ]);
  });
});
