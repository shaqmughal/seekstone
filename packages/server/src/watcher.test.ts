import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import { buildIndex } from './index/build.js';
import { buildAttachmentIndex } from './index/resolve.js';
import type { IndexedNote } from './index/types.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { getLinks } from './tools/get_links.js';
import { listTags } from './tools/list_tags.js';
import { vaultStats } from './tools/vault_stats.js';
import {
  DEFAULT_POLL_INTERVAL_MS,
  resolvePollInterval,
  resolveUsePolling,
  startWatcher,
} from './watcher.js';

// Each test gets its own vault dir. We await the watcher's `ready` promise
// before mutating files, so events are deterministic (no retries needed).
let tmpDir: string;

function freshCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return {
    vaultRoot,
    index,
    notes: new Map(),
    generation: 0,
    backlinks: new Map(),
    attachments: buildAttachmentIndex([]),
    policy: PERMISSIVE_POLICY,
  };
}

interface WaitForOpts {
  timeoutMs?: number;
  /**
   * Invoked every ~2s while still waiting. Used by the file-creation tests to
   * write a new uniquely-named sibling file: under usePolling, chokidar only
   * rescans a directory when its mtime changes, and NTFS directory mtime
   * updates on entry create/delete/rename — not on content writes. On slow
   * Windows runners a single create can slip through a poll tick and stay
   * invisible forever (the SHA-242 flake, rawEvents=(none) after 60s). Each
   * nudge adds a fresh directory transition, so the rescan discovers the
   * missed target. A genuine event-silencing bug (e.g. the SHA-144 8.3-path
   * regression) still fails: nudges change the directory, but silenced
   * watchers deliver nothing regardless.
   */
  nudge?: () => Promise<void>;
}

async function waitFor(condition: () => boolean, opts: WaitForOpts = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  let ticks = 0;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    ticks += 1;
    if (opts.nudge && ticks % 100 === 0) await opts.nudge();
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Nudge helper: create a new (non-.md, so never indexed) sibling per call. */
function dirNudger(dir: string): () => Promise<void> {
  let n = 0;
  return async () => {
    n += 1;
    await writeFile(join(dir, `nudge-${n}.tmp`), String(n), 'utf8');
  };
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-watcher-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// Real-filesystem integration tests. The coverage gate skips them
// (SEEKSTONE_COVERAGE=1): watcher.ts is excluded from coverage and validated
// here in the normal cross-platform Test run, where v8 instrumentation isn't
// starving the event loop.
describe.skipIf(process.env.SEEKSTONE_COVERAGE === '1')('startWatcher', () => {
  it('indexes a new .md file created after startup', async () => {
    // Create-after-ready shape: under usePolling this is the only event kind
    // that needs a parent-dir rescan, so it gets the nudge mitigation and the
    // rawEvents diagnostics (SHA-242 gave them to the nested/spaced tests;
    // this one kept flaking on CI without them — SHA-275).
    const ctx = freshCtx(tmpDir);
    const rawEvents: string[] = [];
    const { stop, ready } = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, abs, rel) => rawEvents.push(`${event} abs=${abs} rel=${rel}`),
    });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'watch-new.md'), 'watcher_unique_abc', 'utf8');
      try {
        await waitFor(() => ctx.notes.has('watch-new.md'), { nudge: dirNudger(tmpDir) });
      } catch {
        throw new Error(
          `waitFor timeout — diagnostics:\n  platform=${process.platform} sep=${JSON.stringify(sep)}\n  vaultRoot=${tmpDir}\n  ctx.notes keys=[${[...ctx.notes.keys()].join(', ')}]\n  rawEvents(${rawEvents.length}):\n    ${rawEvents.join('\n    ') || '(none)'}`,
        );
      }
      expect(ctx.index.search('watcher_unique_abc').some((h) => h.id === 'watch-new.md')).toBe(
        true,
      );
    } finally {
      await stop();
    }
  });

  it('updates the index when a file is modified', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-mod.md'), 'old content', 'utf8');
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'watch-mod.md'), 'new_unique_modified_xyz', 'utf8');
      await waitFor(
        () => ctx.notes.get('watch-mod.md')?.body.includes('new_unique_modified_xyz') ?? false,
      );
      expect(ctx.notes.get('watch-mod.md')?.body).toContain('new_unique_modified_xyz');
    } finally {
      await stop();
    }
  });

  it('refreshes the task index when an edit adds a checkbox', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-task.md'), 'no tasks yet', 'utf8');
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'watch-task.md'), '# Todo\n\n- [ ] watcher task', 'utf8');
      await waitFor(() => (ctx.notes.get('watch-task.md')?.tasks.length ?? 0) > 0);
      const task = ctx.notes.get('watch-task.md')?.tasks[0];
      expect(task).toMatchObject({ line: 3, state: ' ', text: 'watcher task', heading: 'Todo' });
    } finally {
      await stop();
    }
  });

  it('removes a deleted file from the index', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-del.md'), 'will be deleted', 'utf8');
    const doc: IndexedNote = {
      id: 'watch-del.md',
      title: 'watch-del',
      body: 'will be deleted',
      tags: '',
      fmKeys: '',
      fm: null,
      raw: 'will be deleted',
      tasks: [],
      sizeBytes: 15,
      mtimeMs: Date.now(),
    };
    ctx.notes.set('watch-del.md', doc);
    ctx.index.add(doc);

    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await rm(join(tmpDir, 'watch-del.md'));
      await waitFor(() => !ctx.notes.has('watch-del.md'));
      expect(ctx.notes.has('watch-del.md')).toBe(false);
    } finally {
      await stop();
    }
  });

  it('drops notes in a deleted folder and keeps watching a re-created one', async () => {
    // chokidar 6 changed directory-removal handling (chokidar#1421: removed
    // files reported as `unlink`, not `unlinkDir`; chokidar#1463: watching no
    // longer stops after a watched directory is removed). This watcher only
    // handles `unlink`, so pin both behaviors across upgrades.
    const ctx = freshCtx(tmpDir);
    await mkdir(join(tmpDir, 'proj'));
    await writeFile(join(tmpDir, 'proj', 'old.md'), 'in a folder', 'utf8');
    const doc: IndexedNote = {
      id: 'proj/old.md',
      title: 'old',
      body: 'in a folder',
      tags: '',
      fmKeys: '',
      fm: null,
      raw: 'in a folder',
      tasks: [],
      sizeBytes: 11,
      mtimeMs: Date.now(),
    };
    ctx.notes.set('proj/old.md', doc);
    ctx.index.add(doc);

    const rawEvents: string[] = [];
    const { stop, ready } = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, abs, rel) => rawEvents.push(`${event} abs=${abs} rel=${rel}`),
    });
    try {
      await ready;
      await rm(join(tmpDir, 'proj'), { recursive: true });
      await waitFor(() => !ctx.notes.has('proj/old.md'));
      expect(ctx.notes.has('proj/old.md')).toBe(false);

      await mkdir(join(tmpDir, 'proj'));
      await writeFile(join(tmpDir, 'proj', 'new.md'), 'recreated_unique_ghi', 'utf8');
      try {
        await waitFor(() => ctx.notes.has('proj/new.md'), {
          nudge: dirNudger(join(tmpDir, 'proj')),
        });
      } catch {
        throw new Error(
          `waitFor timeout — diagnostics:\n  platform=${process.platform}\n  ctx.notes keys=[${[...ctx.notes.keys()].join(', ')}]\n  rawEvents(${rawEvents.length}):\n    ${rawEvents.join('\n    ') || '(none)'}`,
        );
      }
      expect(ctx.notes.get('proj/new.md')?.body).toContain('recreated_unique_ghi');
    } finally {
      await stop();
    }
  });

  it('detects a new note in a nested folder (the Linux fs.watch gap)', async () => {
    // The crux of SHA-35: fs.watch(recursive) silently misses nested events on
    // Linux; chokidar must deliver them. A single nested add proves recursive
    // delivery (modify/delete handlers are covered by the flat tests above).
    const ctx = freshCtx(tmpDir);
    await mkdir(join(tmpDir, 'a', 'b', 'c'), { recursive: true });
    const rawEvents: string[] = [];
    const { stop, ready } = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, abs, rel) => rawEvents.push(`${event} abs=${abs} rel=${rel}`),
    });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'a', 'b', 'c', 'deep.md'), 'nested_unique_def', 'utf8');
      try {
        await waitFor(() => ctx.notes.has('a/b/c/deep.md'), {
          nudge: dirNudger(join(tmpDir, 'a', 'b', 'c')),
        });
      } catch {
        throw new Error(
          `waitFor timeout — diagnostics:\n  platform=${process.platform} sep=${JSON.stringify(sep)}\n  vaultRoot=${tmpDir}\n  ctx.notes keys=[${[...ctx.notes.keys()].join(', ')}]\n  rawEvents(${rawEvents.length}):\n    ${rawEvents.join('\n    ') || '(none)'}`,
        );
      }
      expect(ctx.notes.get('a/b/c/deep.md')?.body).toContain('nested_unique_def');
    } finally {
      await stop();
    }
  });

  it('handles a vault path containing spaces', async () => {
    const spaced = join(tmpDir, 'My Vault');
    await mkdir(spaced, { recursive: true });
    const ctx = freshCtx(spaced);
    const rawEvents: string[] = [];
    const { stop, ready } = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, abs, rel) => rawEvents.push(`${event} abs=${abs} rel=${rel}`),
    });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(spaced, 'spaced note.md'), 'spaced_unique_ghi', 'utf8');
      try {
        await waitFor(() => ctx.notes.has('spaced note.md'), { nudge: dirNudger(spaced) });
      } catch {
        throw new Error(
          `waitFor timeout — diagnostics:\n  platform=${process.platform} sep=${JSON.stringify(sep)}\n  vaultRoot=${spaced}\n  ctx.notes keys=[${[...ctx.notes.keys()].join(', ')}]\n  rawEvents(${rawEvents.length}):\n    ${rawEvents.join('\n    ') || '(none)'}`,
        );
      }
      expect(ctx.notes.get('spaced note.md')?.body).toContain('spaced_unique_ghi');
    } finally {
      await stop();
    }
  });

  it('logs index updates through an injected logger', async () => {
    const ctx = freshCtx(tmpDir);
    const events: { msg: string; fields?: Record<string, unknown> }[] = [];
    const noop = () => {};
    const log = {
      level: 'debug' as const,
      error: noop,
      warn: noop,
      info: noop,
      debug: (msg: string, fields?: Record<string, unknown>) => events.push({ msg, fields }),
    };
    // Same create-after-ready shape as the first test, observed through the
    // logger instead of ctx.notes — needs the same nudge + diagnostics
    // (SHA-275; nudge files are non-.md so they never produce 'index updated').
    const rawEvents: string[] = [];
    const { stop, ready } = startWatcher(ctx, log, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, abs, rel) => rawEvents.push(`${event} abs=${abs} rel=${rel}`),
    });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'watch-log.md'), 'logged_body_qrs', 'utf8');
      try {
        await waitFor(
          () => events.some((e) => e.msg === 'index updated' && e.fields?.path === 'watch-log.md'),
          { nudge: dirNudger(tmpDir) },
        );
      } catch {
        throw new Error(
          `waitFor timeout — diagnostics:\n  platform=${process.platform} sep=${JSON.stringify(sep)}\n  vaultRoot=${tmpDir}\n  ctx.notes keys=[${[...ctx.notes.keys()].join(', ')}]\n  rawEvents(${rawEvents.length}):\n    ${rawEvents.join('\n    ') || '(none)'}`,
        );
      }
      expect(ctx.notes.has('watch-log.md')).toBe(true);
      expect(
        events.some((e) => e.msg === 'index updated' && e.fields?.path === 'watch-log.md'),
      ).toBe(true);
    } finally {
      await stop();
    }
  });

  it('vault_stats reflects an add, an edit and a delete on the next call', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'a.md'), 'aaaa', 'utf8');
      await writeFile(join(tmpDir, 'b.md'), 'bb', 'utf8');
      await waitFor(() => vaultStats(ctx).notes === 2, { nudge: dirNudger(tmpDir) });
      await writeFile(join(tmpDir, 'a.md'), 'a'.repeat(100), 'utf8');
      await waitFor(() => vaultStats(ctx).bytes.total === 102);
      expect(vaultStats(ctx).bytes.largest).toEqual({ path: 'a.md', size: 100 });
      await rm(join(tmpDir, 'b.md'));
      await waitFor(() => vaultStats(ctx).notes === 1);
      expect(vaultStats(ctx).bytes.total).toBe(100);
    } finally {
      await stop();
    }
  });

  it('list_tags and get_links reflect an add, an edit and a delete on the next call (SHA-461)', async () => {
    await writeFile(join(tmpDir, 'a.md'), 'See [[Short]] #base\n', 'utf8');
    const built = await buildIndex(tmpDir);
    const ctx: ServerContext = { ...built, vaultRoot: tmpDir, policy: PERMISSIVE_POLICY };
    const tags = () => listTags(ctx, { sort: 'name' }).tags.map((t) => t.tag);
    const target = () => getLinks(ctx, { path: 'a.md' }).links[0]?.target;
    // Fill the caches before any event, so a missed bump would serve these.
    expect(tags()).toEqual(['base']);
    expect(target()).toBeUndefined();
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'b.md'), '---\naliases: [Short]\ntags: [one]\n---\nb\n');
      await waitFor(() => tags().includes('one'), { nudge: dirNudger(tmpDir) });
      expect(target()).toBe('b.md');
      await writeFile(join(tmpDir, 'b.md'), '---\naliases: [Other]\ntags: [two]\n---\nb\n');
      await waitFor(() => tags().includes('two'));
      expect(tags()).toEqual(['base', 'two']);
      expect(target()).toBeUndefined();
      await rm(join(tmpDir, 'b.md'));
      await waitFor(() => !tags().includes('two'));
      expect(tags()).toEqual(['base']);
    } finally {
      await stop();
    }
  });

  it('ignores non-.md files', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'image.png'), 'binary', 'utf8');
      await new Promise((r) => setTimeout(r, 150));
      expect(ctx.notes.size).toBe(0);
    } finally {
      await stop();
    }
  });

  it('tracks attachment adds and unlinks so get_links resolves embeds fresh (SHA-553)', async () => {
    await writeFile(join(tmpDir, 'note.md'), '![[new.png]]\n', 'utf8');
    await mkdir(join(tmpDir, 'img'));
    const built = await buildIndex(tmpDir);
    const ctx: ServerContext = { ...built, vaultRoot: tmpDir, policy: PERMISSIVE_POLICY };
    const embed = () => getLinks(ctx, { path: 'note.md' }).links[0];
    expect(embed()).toMatchObject({ resolved: false });
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'img', 'new.png'), 'png', 'utf8');
      await waitFor(() => embed()?.resolved === true, { nudge: dirNudger(join(tmpDir, 'img')) });
      expect(embed()).toMatchObject({ resolved: true, target: 'img/new.png' });
      await rm(join(tmpDir, 'img', 'new.png'));
      await waitFor(() => embed()?.resolved === false);
      expect(embed()?.target).toBeUndefined();
    } finally {
      await stop();
    }
  });

  it('indexes a note with an uppercase .MD extension and drops it on delete (SHA-574)', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'Foo.MD'), 'upper_ext_marker', 'utf8');
      await waitFor(() => ctx.notes.has('Foo.MD'), { nudge: dirNudger(tmpDir) });
      expect(ctx.index.search('upper_ext_marker').map((h) => h.id)).toEqual(['Foo.MD']);
      expect(ctx.attachments.byPath.has('foo.md')).toBe(false);
      await rm(join(tmpDir, 'Foo.MD'));
      await waitFor(() => !ctx.notes.has('Foo.MD'));
      expect(ctx.index.search('upper_ext_marker')).toEqual([]);
      expect(ctx.attachments.byPath.has('foo.md')).toBe(false);
    } finally {
      await stop();
    }
  });

  it('keeps the same notes and attachments as a fresh boot index (SHA-574)', async () => {
    await mkdir(join(tmpDir, 'a'));
    await mkdir(join(tmpDir, 'b'));
    await mkdir(join(tmpDir, 'img'));
    const built = await buildIndex(tmpDir);
    const ctx: ServerContext = { ...built, vaultRoot: tmpDir, policy: PERMISSIVE_POLICY };
    // Separate folders, so the two names can coexist on case-insensitive filesystems.
    const paths = ['a/Foo.md', 'b/Foo.MD', 'img/pic.png'];
    const kinds = (c: Pick<ServerContext, 'notes' | 'attachments'>) =>
      paths.map((p) => ({
        path: p,
        note: c.notes.has(p),
        attachment: c.attachments.byPath.get(p.toLowerCase())?.includes(p) === true,
      }));
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      await writeFile(join(tmpDir, 'a', 'Foo.md'), 'lower', 'utf8');
      await writeFile(join(tmpDir, 'b', 'Foo.MD'), 'upper', 'utf8');
      await writeFile(join(tmpDir, 'img', 'pic.png'), 'png', 'utf8');
      const seen = () => kinds(ctx).every((k) => k.note || k.attachment);
      const nudges = ['a', 'b', 'img'].map((d) => dirNudger(join(tmpDir, d)));
      await waitFor(seen, { nudge: async () => void (await Promise.all(nudges.map((n) => n()))) });
      const fresh = await buildIndex(tmpDir);
      expect(kinds(fresh)).toEqual([
        { path: 'a/Foo.md', note: true, attachment: false },
        { path: 'b/Foo.MD', note: true, attachment: false },
        { path: 'img/pic.png', note: false, attachment: true },
      ]);
      expect(kinds(ctx)).toEqual(kinds(fresh));
    } finally {
      await stop();
    }
  });

  it('ignores files under node_modules, as the boot walk does (SHA-553)', async () => {
    await mkdir(join(tmpDir, 'img'));
    await mkdir(join(tmpDir, 'A'));
    await writeFile(join(tmpDir, 'img', 'logo.png'), 'png', 'utf8');
    await writeFile(join(tmpDir, 'note.md'), '![[logo.png]]\n', 'utf8');
    const built = await buildIndex(tmpDir);
    const ctx: ServerContext = { ...built, vaultRoot: tmpDir, policy: PERMISSIVE_POLICY };
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      // A/node_modules/... sorts before img/, so it would win the basename tie.
      await mkdir(join(tmpDir, 'A', 'node_modules', 'pkg'), { recursive: true });
      await writeFile(join(tmpDir, 'A', 'node_modules', 'pkg', 'logo.png'), 'png', 'utf8');
      await writeFile(join(tmpDir, 'A', 'late.png'), 'png', 'utf8');
      await waitFor(() => ctx.attachments.byPath.has('a/late.png'), {
        nudge: dirNudger(join(tmpDir, 'A')),
      });
      expect([...ctx.attachments.byPath.keys()].some((k) => k.includes('node_modules'))).toBe(
        false,
      );
      expect(getLinks(ctx, { path: 'note.md' }).links[0]).toMatchObject({
        resolved: true,
        target: 'img/logo.png',
      });
    } finally {
      await stop();
    }
  });

  it('returns a stop function whose promise resolves once the watcher closes', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    await expect(stop()).resolves.toBeUndefined();
  });
});

// Pure interval resolution — no watcher spun up, so no coverage-gate skip.
describe('resolveUsePolling', () => {
  it('is off by default and on for 1, true, yes and on (SHA-633)', () => {
    expect(resolveUsePolling(undefined, undefined)).toBe(false);
    expect(resolveUsePolling(undefined, '')).toBe(false);
    expect(resolveUsePolling(undefined, 'false')).toBe(false);
    for (const v of ['1', 'true', 'TRUE', 'yes', ' on ']) {
      expect(resolveUsePolling(undefined, v)).toBe(true);
    }
  });
  it('lets the explicit option win over the env', () => {
    expect(resolveUsePolling(false, 'true')).toBe(false);
    expect(resolveUsePolling(true, '0')).toBe(true);
  });
});

describe('resolvePollInterval', () => {
  const warns: { msg: string; fields?: Record<string, unknown> }[] = [];
  const noop = () => {};
  const log = {
    level: 'warn' as const,
    error: noop,
    warn: (msg: string, fields?: Record<string, unknown>) => warns.push({ msg, fields }),
    info: noop,
    debug: noop,
  };

  beforeEach(() => {
    warns.length = 0;
  });

  it('defaults with neither option nor env set', () => {
    expect(resolvePollInterval(undefined, undefined)).toBe(DEFAULT_POLL_INTERVAL_MS);
    expect(resolvePollInterval(undefined, '')).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  it('reads the env value as milliseconds', () => {
    expect(resolvePollInterval(undefined, '2000')).toBe(2000);
  });

  it('prefers the explicit option over the env value', () => {
    expect(resolvePollInterval(50, '2000')).toBe(50);
  });

  it('warns and falls back on a malformed env value', () => {
    for (const bad of ['abc', '0', '-5', '1.5']) {
      expect(resolvePollInterval(undefined, bad, log)).toBe(DEFAULT_POLL_INTERVAL_MS);
    }
    expect(warns).toHaveLength(4);
    expect(warns[0]?.msg).toContain('SEEKSTONE_WATCH_POLL_INTERVAL');
  });
});
