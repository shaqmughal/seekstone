import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog, type AuditRecord } from '../audit.js';
import type { ServerContext } from '../context.js';
import { dispatch, WRITE_TOOLS } from '../dispatch.js';
import { buildIndex } from '../index/build.js';
import { Journal } from '../journal.js';
import { createLogger } from '../log.js';
import { parseWritePolicy } from '../policy.js';

/**
 * SHA-575: a symlink inside the vault must not take a read or a write outside
 * the vault, past SEEKSTONE_READ_PATHS / SEEKSTONE_WRITE_PATHS, or into the
 * reserved folders. Links whose real target stays inside the vault keep
 * working, and SEEKSTONE_FOLLOW_SYMLINKS=1 allows links that leave the vault
 * (the scopes and reserved folders still apply to real paths in the vault).
 *
 * Folder links are junctions on Windows, which need no privilege. File links
 * need the symlink privilege there, so those cases are skipped when the
 * process can't create one.
 */

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
const OUT_TEXT = 'outside-the-vault marker';
const HIDDEN_TEXT = 'hidden-folder marker';

const canLinkFiles = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'seekstone-linkprobe-'));
  try {
    writeFileSync(join(dir, 'a'), '');
    symlinkSync(join(dir, 'a'), join(dir, 'b'), 'file');
    return true;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
})();
const itFileLinks = it.skipIf(!canLinkFiles);

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
  const put = async (abs: string, body: string) => {
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body, 'utf8');
  };
  await put(join(vault, 'notes', 'a.md'), '# A\n\n- [ ] task\n');
  await put(join(vault, 'private', 'secret.md'), `# Secret\n\n${HIDDEN_TEXT}\n`);
  await put(join(vault, '.trash', 'Old.md'), '# Old\n');
  await put(join(outside, 'o.md'), `# Out\n\n${OUT_TEXT}\n\n- [ ] task\n`);
  await put(join(outside, 'sub', 'deep.md'), `# Deep\n\n${OUT_TEXT}\n`);
  await put(join(base, 'back', 'placeholder.md'), '');

  // Folder links.
  linkDir(outside, join(vault, 'ext')); // absolute, out of the vault
  linkDir(join('..', '..', 'outside'), join(vault, 'notes', 'rel-ext')); // relative, out
  linkDir(outside, join(vault, 'notes', 'deeplink')); // nested, out
  linkDir(join(vault, 'notes'), join(vault, 'inner')); // stays in the vault
  linkDir(join(vault, '.trash'), join(vault, 'notes', 'trashlink')); // into .trash
  linkDir(join(vault, 'private'), join(vault, 'notes', 'privlink')); // into a hidden folder
  linkDir(join(base, 'missing'), join(vault, 'dead')); // dangling
  // Out of the vault and back in: the real path is inside.
  linkDir(join(vault, 'notes'), join(base, 'back', 'in'));
  linkDir(join(base, 'back'), join(vault, 'round'));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function makeCtx(env: Record<string, string> = {}): Promise<ServerContext> {
  // The .seekstone link needs the journal folder to exist first.
  const journal = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 });
  if (!existsSync(join(vault, 'notes', 'histlink'))) {
    linkDir(join(vault, '.seekstone'), join(vault, 'notes', 'histlink'));
  }
  const built = await buildIndex(vault);
  return {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    generation: 0,
    backlinks: built.backlinks,
    attachments: built.attachments,
    policy: parseWritePolicy(env),
    journal,
    audit: AuditLog.open({ path: auditPath, maxBytes: 1e9 }),
  };
}

async function call(ctx: ServerContext, tool: string, args: Record<string, unknown>) {
  const r = await dispatch(ctx, tool, args, log);
  return { isError: r.isError === true, text: r.content[0]?.text ?? '' };
}

async function records(): Promise<AuditRecord[]> {
  const raw = await readFile(auditPath, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as AuditRecord);
}

const OUTSIDE_MSG =
  /goes through a symlink to a location outside the vault\. Set SEEKSTONE_FOLLOW_SYMLINKS=1/;
const DANGLING_MSG = /goes through a symlink that is dangling or loops/;

describe('reads through a symlink (default)', () => {
  it.each([
    ['an absolute folder link', 'ext/o.md'],
    ['a relative folder link', 'notes/rel-ext/o.md'],
    ['a link in an intermediate folder', 'notes/deeplink/sub/deep.md'],
  ])('refuses a path through %s that leaves the vault', async (_how, path) => {
    const ctx = await makeCtx();
    for (const tool of ['read_note', 'outline_note']) {
      const r = await call(ctx, tool, { path });
      expect(r.isError, tool).toBe(true);
      expect(r.text, tool).toMatch(OUTSIDE_MSG);
      expect(r.text, tool).not.toContain(OUT_TEXT);
    }
  });

  itFileLinks('refuses a file link that leaves the vault', async () => {
    symlinkSync(join(outside, 'o.md'), join(vault, 'outfile.md'), 'file');
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'outfile.md' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(OUTSIDE_MSG);
    expect(r.text).not.toContain(OUT_TEXT);
  });

  it('reads through a folder link that stays in the vault', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'inner/a.md' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('# A');
  });

  it('reads through a link that leaves the vault and comes back in', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'round/in/a.md' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('# A');
  });

  itFileLinks('reads through a file link that stays in the vault', async () => {
    symlinkSync(join(vault, 'notes', 'a.md'), join(vault, 'notes', 'inlink.md'), 'file');
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'notes/inlink.md' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('# A');
  });

  it('refuses a path through a dangling folder link', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'read_note', { path: 'dead/x.md' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(DANGLING_MSG);
  });

  itFileLinks('refuses a dangling file link and a link loop', async () => {
    symlinkSync(join(base, 'nope.md'), join(vault, 'dead.md'), 'file');
    symlinkSync(join(vault, 'loop-b.md'), join(vault, 'loop-a.md'), 'file');
    symlinkSync(join(vault, 'loop-a.md'), join(vault, 'loop-b.md'), 'file');
    const ctx = await makeCtx();
    for (const path of ['dead.md', 'loop-a.md']) {
      const r = await call(ctx, 'read_note', { path });
      expect(r.isError, path).toBe(true);
      expect(r.text, path).toMatch(DANGLING_MSG);
    }
  });

  it('hides a file the read scope hides, when reached through a link', async () => {
    const modes: Record<string, string>[] = [{}, { SEEKSTONE_FOLLOW_SYMLINKS: '1' }];
    for (const follow of modes) {
      const ctx = await makeCtx({ SEEKSTONE_READ_PATHS: 'notes/**', ...follow });
      const r = await call(ctx, 'read_note', { path: 'notes/privlink/secret.md' });
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(/ENOENT/);
      expect(r.text).not.toContain(HIDDEN_TEXT);
    }
  });
});

describe('reads with SEEKSTONE_FOLLOW_SYMLINKS=1', () => {
  it('reads through links that leave the vault', async () => {
    const ctx = await makeCtx({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    for (const path of ['ext/o.md', 'notes/rel-ext/o.md', 'notes/deeplink/sub/deep.md']) {
      const r = await call(ctx, 'read_note', { path });
      expect(r.isError, path).toBe(false);
      expect(r.text, path).toContain(OUT_TEXT);
    }
  });

  it('still applies the read scope to the path as written', async () => {
    const ctx = await makeCtx({
      SEEKSTONE_FOLLOW_SYMLINKS: '1',
      SEEKSTONE_READ_PATHS: 'notes/**',
    });
    expect((await call(ctx, 'read_note', { path: 'ext/o.md' })).isError).toBe(true);
    expect((await call(ctx, 'read_note', { path: 'notes/deeplink/sub/deep.md' })).text).toContain(
      OUT_TEXT,
    );
  });

  it('still refuses a dangling link', async () => {
    const ctx = await makeCtx({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    const r = await call(ctx, 'read_note', { path: 'dead/x.md' });
    expect(r.text).toMatch(DANGLING_MSG);
  });
});

/** Tool name → args that write to `p`. */
const writeCalls: [string, (p: string) => Record<string, unknown>][] = [
  ['create_note', (p) => ({ path: p, content: 'x', overwrite: true })],
  ['delete_note', (p) => ({ path: p })],
  ['delete_note (permanent)', (p) => ({ path: p, permanent: true })],
  ['move_note (from)', (p) => ({ from: p, to: 'notes/moved.md' })],
  ['move_note (to)', (p) => ({ from: 'notes/a.md', to: p, overwrite: true })],
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

describe('writes through a symlink (default)', () => {
  it('covers every write tool that takes a path', () => {
    const covered = new Set(writeCalls.map(([name]) => name.split(' ')[0]));
    // Computed paths, tested separately below.
    const computed = new Set(['undo_write', 'append_periodic_note']);
    expect([...WRITE_TOOLS].filter((t) => !covered.has(t) && !computed.has(t))).toEqual([]);
  });

  it('refuses every write tool on a file reached through a link that leaves the vault', async () => {
    const ctx = await makeCtx();
    const before = await readFile(join(outside, 'o.md'), 'utf8');
    for (const [label, args] of writeCalls) {
      for (const path of ['ext/o.md', 'notes/rel-ext/o.md']) {
        const r = await call(ctx, label.split(' ')[0] ?? label, args(path));
        expect(r.isError, `${label} ${path}`).toBe(true);
        expect(r.text, `${label} ${path}`).toMatch(OUTSIDE_MSG);
      }
    }
    expect(await readFile(join(outside, 'o.md'), 'utf8')).toBe(before);
    expect(existsSync(join(vault, 'notes', 'a.md'))).toBe(true);
  });

  it('refuses to create a new file in a linked folder outside the vault', async () => {
    const ctx = await makeCtx();
    for (const path of ['ext/new.md', 'notes/deeplink/sub/new.md', 'ext/fresh/dir/new.md']) {
      const r = await call(ctx, 'create_note', { path, content: 'x' });
      expect(r.isError, path).toBe(true);
      expect(r.text, path).toMatch(OUTSIDE_MSG);
    }
    expect(existsSync(join(outside, 'new.md'))).toBe(false);
    expect(existsSync(join(outside, 'sub', 'new.md'))).toBe(false);
    expect(existsSync(join(outside, 'fresh'))).toBe(false);
  });

  it('writes through a folder link that stays in the vault', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'create_note', { path: 'inner/new.md', content: 'hello' });
    expect(r.isError, r.text).toBe(false);
    expect(await readFile(join(vault, 'notes', 'new.md'), 'utf8')).toBe('hello');
    const a = await call(ctx, 'append_note', { path: 'round/in/a.md', content: 'more' });
    expect(a.isError, a.text).toBe(false);
    expect(await readFile(join(vault, 'notes', 'a.md'), 'utf8')).toContain('more');
  });

  it('refuses to write through a dangling folder link', async () => {
    const ctx = await makeCtx();
    const r = await call(ctx, 'create_note', { path: 'dead/x.md', content: 'x' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(DANGLING_MSG);
    expect(existsSync(join(base, 'missing'))).toBe(false);
  });

  itFileLinks('refuses to write to a dangling file link', async () => {
    symlinkSync(join(base, 'nope.md'), join(vault, 'dead.md'), 'file');
    const ctx = await makeCtx();
    const r = await call(ctx, 'create_note', { path: 'dead.md', content: 'x', overwrite: true });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(DANGLING_MSG);
    expect(existsSync(join(base, 'nope.md'))).toBe(false);
  });

  itFileLinks('refuses a file link that leaves the vault', async () => {
    symlinkSync(join(outside, 'o.md'), join(vault, 'outfile.md'), 'file');
    const ctx = await makeCtx();
    const r = await call(ctx, 'append_note', { path: 'outfile.md', content: 'x' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(OUTSIDE_MSG);
  });
});

describe('reserved folders through a symlink', () => {
  for (const follow of [false, true]) {
    const env: Record<string, string> = follow ? { SEEKSTONE_FOLLOW_SYMLINKS: '1' } : {};
    it(`refuses writes that land in .trash/ or .seekstone/ (follow ${follow})`, async () => {
      const ctx = await makeCtx(env);
      const manifest = join(vault, '.seekstone', 'history', 'manifest.jsonl');
      const manifestBefore = existsSync(manifest) ? await readFile(manifest, 'utf8') : '';
      const cases: [string, Record<string, unknown>][] = [
        ['create_note', { path: 'notes/trashlink/x.md', content: 'x' }],
        [
          'create_note',
          { path: 'notes/histlink/history/manifest.jsonl', content: 'forged', overwrite: true },
        ],
        ['move_note', { from: 'notes/a.md', to: 'notes/trashlink/a.md' }],
        // move_note may restore out of .trash/ only when the path says so.
        ['move_note', { from: 'notes/trashlink/Old.md', to: 'notes/restored.md' }],
        ['append_note', { path: 'inner/trashlink/Old.md', content: 'x' }],
      ];
      for (const [tool, args] of cases) {
        const r = await call(ctx, tool, args);
        expect(r.isError, `${tool} ${JSON.stringify(args)}`).toBe(true);
        expect(r.text).toMatch(
          / goes through a symlink to a path that is inside \.(trash|seekstone)\/, which Seekstone reserves/,
        );
      }
      expect(existsSync(join(vault, '.trash', 'x.md'))).toBe(false);
      expect(existsSync(join(vault, '.trash', 'a.md'))).toBe(false);
      expect(await readFile(join(vault, '.trash', 'Old.md'), 'utf8')).toBe('# Old\n');
      expect(existsSync(manifest) ? await readFile(manifest, 'utf8') : '').toBe(manifestBefore);
      const audited = (await records()).filter((r) => r.outcome === 'policy_denied');
      expect(audited.length).toBe(cases.length);
      expect(audited.every((r) => r.policy === 'reserved_path')).toBe(true);
    });
  }
});

describe('path scopes through a symlink', () => {
  for (const follow of [false, true]) {
    const env: Record<string, string> = follow ? { SEEKSTONE_FOLLOW_SYMLINKS: '1' } : {};
    it(`applies SEEKSTONE_WRITE_PATHS to the real path (follow ${follow})`, async () => {
      const ctx = await makeCtx({ SEEKSTONE_WRITE_PATHS: 'notes/**', ...env });
      const r = await call(ctx, 'create_note', { path: 'notes/privlink/x.md', content: 'x' });
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(
        /goes through a symlink to a path that is outside SEEKSTONE_WRITE_PATHS/,
      );
      expect(existsSync(join(vault, 'private', 'x.md'))).toBe(false);
      const audited = await records();
      expect(audited.at(-1)?.policy).toBe('write_paths');
    });

    it(`applies SEEKSTONE_READ_PATHS to the real path of a write (follow ${follow})`, async () => {
      const ctx = await makeCtx({ SEEKSTONE_READ_PATHS: 'notes/**', ...env });
      const r = await call(ctx, 'append_note', { path: 'notes/privlink/secret.md', content: 'x' });
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(
        /goes through a symlink to a path that is outside SEEKSTONE_READ_PATHS/,
      );
      // The hidden real path is not named.
      expect(r.text).not.toContain('private');
      expect(await readFile(join(vault, 'private', 'secret.md'), 'utf8')).toBe(
        `# Secret\n\n${HIDDEN_TEXT}\n`,
      );
    });
  }
});

describe('writes with SEEKSTONE_FOLLOW_SYMLINKS=1', () => {
  it('writes through links that leave the vault', async () => {
    const ctx = await makeCtx({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    const c = await call(ctx, 'create_note', { path: 'ext/new.md', content: 'made' });
    expect(c.isError, c.text).toBe(false);
    expect(await readFile(join(outside, 'new.md'), 'utf8')).toBe('made');
    const a = await call(ctx, 'append_note', { path: 'notes/deeplink/o.md', content: 'more' });
    expect(a.isError, a.text).toBe(false);
    expect(await readFile(join(outside, 'o.md'), 'utf8')).toContain('more');
  });

  it('applies SEEKSTONE_WRITE_PATHS to the path as written when the target is outside', async () => {
    const ctx = await makeCtx({
      SEEKSTONE_FOLLOW_SYMLINKS: '1',
      SEEKSTONE_WRITE_PATHS: 'notes/**',
    });
    const refused = await call(ctx, 'create_note', { path: 'ext/new.md', content: 'x' });
    expect(refused.text).toMatch(/is outside SEEKSTONE_WRITE_PATHS/);
    const allowed = await call(ctx, 'create_note', { path: 'notes/deeplink/new.md', content: 'x' });
    expect(allowed.isError, allowed.text).toBe(false);
  });

  it('still refuses a dangling link', async () => {
    const ctx = await makeCtx({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    const r = await call(ctx, 'create_note', { path: 'dead/x.md', content: 'x' });
    expect(r.text).toMatch(DANGLING_MSG);
  });
});

describe('periodic notes in a linked folder', () => {
  beforeEach(async () => {
    await mkdir(join(vault, '.obsidian'), { recursive: true });
    await writeFile(
      join(vault, '.obsidian', 'daily-notes.json'),
      JSON.stringify({ folder: 'ext/daily' }),
    );
  });

  it('refuses to create or append the note outside the vault', async () => {
    const ctx = await makeCtx();
    const g = await call(ctx, 'get_periodic_note', { createIfMissing: true });
    expect(g.isError).toBe(true);
    expect(g.text).toMatch(OUTSIDE_MSG);
    const a = await call(ctx, 'append_periodic_note', { content: 'x' });
    expect(a.isError).toBe(true);
    expect(a.text).toMatch(OUTSIDE_MSG);
    expect(existsSync(join(outside, 'daily'))).toBe(false);
  });

  it('does not report whether the note exists outside the vault', async () => {
    const ctx = await makeCtx();
    const first = await call(ctx, 'get_periodic_note', {});
    const path = (JSON.parse(first.text) as { path: string }).path;
    await mkdir(join(outside, 'daily'), { recursive: true });
    await writeFile(join(outside, path.replace(/^ext\//, '')), 'exists');
    const r = await call(ctx, 'get_periodic_note', {});
    expect(JSON.parse(r.text)).toMatchObject({ existed: false });
  });
});

describe('undo_write through a link swapped in after the write', () => {
  it('refuses to restore into a folder that now leads outside the vault', async () => {
    const ctx = await makeCtx();
    const c = await call(ctx, 'create_note', { path: 'later/n.md', content: 'v1' });
    expect(c.isError, c.text).toBe(false);
    await rm(join(vault, 'later'), { recursive: true });
    linkDir(outside, join(vault, 'later'));
    await writeFile(join(outside, 'n.md'), 'v1');
    const u = await call(ctx, 'undo_write', {});
    expect(u.isError).toBe(true);
    expect(u.text).toMatch(OUTSIDE_MSG);
    expect(existsSync(join(outside, 'n.md'))).toBe(true);
  });
});

describe('a folder swapped for a link after indexing', () => {
  async function swapNotesForLink(): Promise<void> {
    await rm(join(vault, 'notes'), { recursive: true });
    await writeFile(join(outside, 'a.md'), `# Swapped\n\n${OUT_TEXT}\n`);
    linkDir(outside, join(vault, 'notes'));
  }

  it('still refuses writes to an indexed note, with no watcher running', async () => {
    const ctx = await makeCtx();
    expect(ctx.notes.has('notes/a.md')).toBe(true);
    await swapNotesForLink();
    const r = await call(ctx, 'append_note', { path: 'notes/a.md', content: 'x' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(OUTSIDE_MSG);
    expect(await readFile(join(outside, 'a.md'), 'utf8')).not.toContain('x\n');
  });
});

describe('notes written through a link stay out of the index', () => {
  it('does not index a linked path, so retargeting the link is caught on read', async () => {
    const ctx = await makeCtx();
    const c = await call(ctx, 'create_note', { path: 'inner/new.md', content: 'hello' });
    expect(c.isError, c.text).toBe(false);
    expect(ctx.notes.has('inner/new.md')).toBe(false);
    await rm(join(vault, 'inner'));
    await writeFile(join(outside, 'new.md'), OUT_TEXT);
    linkDir(outside, join(vault, 'inner'));
    const r = await call(ctx, 'read_note', { path: 'inner/new.md' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(OUTSIDE_MSG);
    expect(r.text).not.toContain(OUT_TEXT);
  });

  it('does not index a path written through a link out of the vault, with the opt-in', async () => {
    const ctx = await makeCtx({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    const c = await call(ctx, 'create_note', { path: 'ext/new.md', content: 'made' });
    expect(c.isError, c.text).toBe(false);
    expect(ctx.notes.has('ext/new.md')).toBe(false);
    const s = await call(ctx, 'search', { query: 'made' });
    expect(s.text).not.toContain('ext/new.md');
  });
});

describe('the index', () => {
  it('does not walk into links, in either mode', async () => {
    if (canLinkFiles) symlinkSync(join(outside, 'o.md'), join(vault, 'outfile.md'), 'file');
    const built = await buildIndex(vault);
    const keys = [...built.notes.keys()];
    expect(keys).toContain('notes/a.md');
    expect(
      keys.filter((k) => /^(ext|inner|round|dead|outfile)|rel-ext|deeplink|privlink/.test(k)),
    ).toEqual([]);
  });
});
