import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import { buildIndex } from './index/build.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { startWatcher } from './watcher.js';

/**
 * SHA-575: the watcher never indexes through a symlink and clears whatever
 * was indexed under a folder or note that becomes one. These replay what
 * chokidar 6 sends with followSymlinks off (folder → link: unlinkDir for old
 * subfolders, add for a file inside the target, change for the link; note →
 * link: change; link removed: unlinkDir), in native and polling mode.
 */

const OUT = 'outside-the-vault marker';
let base: string;
let vault: string;
let outside: string;
let syncN = 0;

function linkDir(target: string, path: string): void {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'seekstone-watch-links-'));
  vault = join(base, 'vault');
  outside = join(base, 'outside');
  mkdirSync(join(vault, 'proj', 'sub'), { recursive: true });
  mkdirSync(join(outside, 'proj'), { recursive: true });
  writeFileSync(join(vault, 'proj', 'n.md'), '# N\n');
  writeFileSync(join(vault, 'proj', 'sub', 's.md'), '# S\n');
  writeFileSync(join(vault, 'proj', 'img.png'), 'png');
  writeFileSync(join(vault, 'x.md'), '# X\n');
  writeFileSync(join(outside, 'proj', 'n.md'), OUT);
  writeFileSync(join(outside, 'o.md'), OUT);
  writeFileSync(join(outside, 'pic.png'), 'png');
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

async function makeCtx(): Promise<ServerContext> {
  const built = await buildIndex(vault);
  return {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    generation: 0,
    backlinks: built.backlinks,
    attachments: built.attachments,
    unresolved: built.unresolved,
    policy: PERMISSIVE_POLICY,
  };
}

async function waitFor(cond: () => boolean, nudgeDir?: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let ticks = 0;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    ticks += 1;
    if (nudgeDir !== undefined && ticks % 100 === 0) {
      writeFileSync(join(nudgeDir, `nudge-${ticks}.tmp`), '');
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** A positive event to wait on before asserting that something did NOT happen. */
async function settle(ctx: ServerContext): Promise<void> {
  syncN += 1;
  const name = `sync-${syncN}.md`;
  writeFileSync(join(vault, name), '# sync\n');
  await waitFor(() => ctx.notes.has(name), vault);
}

const noOutside = (ctx: ServerContext) =>
  [...ctx.notes.values()].every((n) => !n.raw.includes(OUT));

describe.skipIf(process.env.SEEKSTONE_COVERAGE === '1').each([
  ['native', false],
  ['polling', true],
])('watcher and symlinks (%s)', (_mode, usePolling) => {
  const start = (ctx: ServerContext) =>
    startWatcher(ctx, undefined, { usePolling, pollInterval: 50 });

  it('drops notes and attachments under a folder replaced by a link', async () => {
    const ctx = await makeCtx();
    expect(ctx.notes.has('proj/n.md')).toBe(true);
    const { stop, ready } = start(ctx);
    try {
      await ready;
      rmSync(join(vault, 'proj'), { recursive: true });
      linkDir(join(outside, 'proj'), join(vault, 'proj'));
      await waitFor(() => !ctx.notes.has('proj/n.md') && !ctx.notes.has('proj/sub/s.md'), vault);
      await settle(ctx);
      expect(ctx.notes.has('proj/n.md')).toBe(false);
      expect(ctx.attachments.byPath.has('proj/img.png')).toBe(false);
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);

  it('drops a note replaced by a link to a file outside the vault', async () => {
    const ctx = await makeCtx();
    const { stop, ready } = start(ctx);
    try {
      await ready;
      symlinkSync(join(outside, 'o.md'), join(vault, 'tmp-link.md'), 'file');
      renameSync(join(vault, 'tmp-link.md'), join(vault, 'x.md'));
      await waitFor(() => !ctx.notes.has('x.md'), vault);
      await settle(ctx);
      expect(ctx.notes.has('x.md')).toBe(false);
      expect(ctx.notes.has('tmp-link.md')).toBe(false);
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);

  it('never indexes through a new link: folder, file, attachment or x.md-named folder', async () => {
    const ctx = await makeCtx();
    const { stop, ready } = start(ctx);
    try {
      await ready;
      linkDir(outside, join(vault, 'ext'));
      symlinkSync(join(outside, 'o.md'), join(vault, 'outfile.md'), 'file');
      symlinkSync(join(outside, 'pic.png'), join(vault, 'pic.png'), 'file');
      linkDir(join(vault, 'proj'), join(vault, 'dirlink.md'));
      // A file added inside a linked folder's target after the link exists.
      writeFileSync(join(outside, 'later.md'), OUT);
      await settle(ctx);
      await settle(ctx);
      for (const key of ctx.notes.keys()) {
        expect(
          key.startsWith('ext/') || key === 'outfile.md' || key.startsWith('dirlink.md'),
          key,
        ).toBe(false);
      }
      expect(ctx.attachments.byPath.has('pic.png')).toBe(false);
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);
  it('indexes nothing when a folder link is retargeted to another outside folder', async () => {
    mkdirSync(join(outside, 'a'));
    mkdirSync(join(outside, 'b'));
    writeFileSync(join(outside, 'b', 'later.md'), OUT);
    linkDir(join(outside, 'a'), join(vault, 'ext'));
    const ctx = await makeCtx();
    const { stop, ready } = start(ctx);
    try {
      await ready;
      if (process.platform === 'win32') {
        // Windows can't rename a junction over another, so retarget the way
        // Windows tools do: remove the old link, then make the new one.
        rmSync(join(vault, 'ext'));
        linkDir(join(outside, 'b'), join(vault, 'ext'));
      } else {
        // ln -sfn: a new link renamed over the old one.
        linkDir(join(outside, 'b'), join(vault, 'ext-tmp'));
        renameSync(join(vault, 'ext-tmp'), join(vault, 'ext'));
      }
      writeFileSync(join(outside, 'b', 'later2.md'), OUT);
      await settle(ctx);
      await settle(ctx);
      for (const key of ctx.notes.keys()) expect(key.startsWith('ext'), key).toBe(false);
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);

  it('removing a link brings in no outside content', async () => {
    linkDir(outside, join(vault, 'ext'));
    const ctx = await makeCtx();
    const { stop, ready } = start(ctx);
    try {
      await ready;
      rmSync(join(vault, 'ext'));
      mkdirSync(join(vault, 'ext'));
      writeFileSync(join(vault, 'ext', 'real.md'), '# Real\n');
      await settle(ctx);
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);

  it('keeps notes when a deleted folder is recreated before the event lands', async () => {
    const ctx = await makeCtx();
    const { stop, ready } = start(ctx);
    try {
      await ready;
      rmSync(join(vault, 'proj'), { recursive: true });
      mkdirSync(join(vault, 'proj', 'sub'), { recursive: true });
      writeFileSync(join(vault, 'proj', 'n.md'), '# N\n');
      writeFileSync(join(vault, 'proj', 'sub', 's.md'), '# S\n');
      await settle(ctx);
      await waitFor(() => ctx.notes.has('proj/n.md') && ctx.notes.has('proj/sub/s.md'), vault);
    } finally {
      await stop();
    }
  }, 60_000);

  // FIFOs can't be made on Windows.
  it.runIf(process.platform !== 'win32')(
    'does not hang on a link to a FIFO or a real FIFO named x.md',
    async () => {
      execFileSync('mkfifo', [join(outside, 'pipe')]);
      execFileSync('mkfifo', [join(vault, 'boot-fifo.md')]); // present at boot too
      const ctx = await makeCtx();
      expect(ctx.notes.has('boot-fifo.md')).toBe(false);
      const { stop, ready } = start(ctx);
      try {
        await ready;
        symlinkSync(join(outside, 'pipe'), join(vault, 'pipe-link.md'), 'file');
        execFileSync('mkfifo', [join(vault, 'fifo.md')]);
        await settle(ctx);
        expect(ctx.notes.has('pipe-link.md')).toBe(false);
        expect(ctx.notes.has('fifo.md')).toBe(false);
      } finally {
        await stop();
      }
    },
    60_000,
  );
});

// Native only: under SEEKSTONE_WATCH_POLL, chokidar doesn't start watching a
// folder that replaces a link it skipped, so the new folder's notes appear
// after a restart. That gap predates this change and is tracked as SHA-620
// item 2 (a PRD non-goal).
describe.skipIf(process.env.SEEKSTONE_COVERAGE === '1')('watcher after a link is removed', () => {
  it("keeps watching when a real folder takes the link's place", async () => {
    const ctx = await makeCtx();
    linkDir(outside, join(vault, 'ext'));
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: false });
    try {
      await ready;
      rmSync(join(vault, 'ext'));
      mkdirSync(join(vault, 'ext'));
      writeFileSync(join(vault, 'ext', 'real.md'), '# Real\n');
      await waitFor(() => ctx.notes.has('ext/real.md'), join(vault, 'ext'));
      expect(noOutside(ctx)).toBe(true);
    } finally {
      await stop();
    }
  }, 60_000);
});

// POSIX only (Windows has no search bit), and not as root, which ignores it.
describe.skipIf(process.env.SEEKSTONE_COVERAGE === '1')(
  'watcher when a folder cannot be inspected',
  () => {
    it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
      'skips an unlinkDir it cannot check, without throwing, and keeps running',
      async () => {
        const ctx = await makeCtx();
        const { stop, ready } = startWatcher(ctx, undefined, {
          usePolling: true,
          pollInterval: 50,
        });
        try {
          await ready;
          rmSync(join(vault, 'proj', 'sub'), { recursive: true });
          // Readable but not searchable: the poll sees sub gone, lstat fails.
          chmodSync(join(vault, 'proj'), 0o600);
          await new Promise((r) => setTimeout(r, 500));
          chmodSync(join(vault, 'proj'), 0o755);
          await settle(ctx);
          expect(ctx.notes.has('proj/n.md')).toBe(true);
        } finally {
          chmodSync(join(vault, 'proj'), 0o755);
          await stop();
        }
      },
      60_000,
    );
  },
);
