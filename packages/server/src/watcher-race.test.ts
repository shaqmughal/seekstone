import { realpathSync } from 'node:fs';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { buildAttachmentIndex } from './index/resolve.js';
import type { IndexedNote } from './index/types.js';
import type { Logger } from './log.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { startWatcher } from './watcher.js';

/**
 * SHA-575: the watcher must index only bytes from the file its symlink check
 * approved. The fs mock swaps the note for a symlink to a file outside the
 * vault right before the watcher opens it, and swaps a regular file back
 * right after, so checks made on the path before and after the read both
 * see a regular file. Only binding the read to the checked file catches it.
 */

const race = vi.hoisted(() => ({
  armed: false,
  target: '',
  swapIn: async () => {},
  swapBack: async () => {},
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  async function raced<T>(p: unknown, op: () => Promise<T>): Promise<T> {
    if (!race.armed || String(p) !== race.target) return op();
    race.armed = false;
    await race.swapIn();
    try {
      return await op();
    } finally {
      await race.swapBack();
    }
  }
  return {
    ...actual,
    readFile: ((p: Parameters<typeof actual.readFile>[0], ...rest: unknown[]) =>
      raced(p, () =>
        (actual.readFile as (...a: unknown[]) => Promise<unknown>)(p, ...rest),
      )) as typeof actual.readFile,
    open: ((p: Parameters<typeof actual.open>[0], ...rest: unknown[]) =>
      raced(p, () =>
        (actual.open as (...a: unknown[]) => Promise<unknown>)(p, ...rest),
      )) as typeof actual.open,
  };
});

const OUT_TEXT = 'outside-the-vault marker';
let vault: string;
let outside: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-race-'));
  outside = await mkdtemp(join(tmpdir(), 'seekstone-race-outside-'));
  await writeFile(join(outside, 'o.md'), `# Out\n\n${OUT_TEXT}\n`, 'utf8');
});

afterEach(async () => {
  race.armed = false;
  await rm(vault, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

function emptyCtx(): ServerContext {
  return {
    vaultRoot: vault,
    index: new MiniSearch<IndexedNote>({ idField: 'id', fields: ['title', 'body'] }),
    notes: new Map(),
    generation: 0,
    backlinks: new Map(),
    attachments: buildAttachmentIndex([]),
    policy: PERMISSIVE_POLICY,
  };
}

describe('watcher read binding (SHA-575)', () => {
  it('never indexes bytes from a link swapped in around the read', async () => {
    const realVault = realpathSync(vault);
    const note = join(realVault, 'race.md');
    let canLink = true;
    try {
      await symlink(join(outside, 'o.md'), join(vault, 'probe.md'), 'file');
      await rm(join(vault, 'probe.md'));
    } catch {
      canLink = false; // Windows without the symlink privilege.
    }
    if (!canLink) return;

    const ctx = emptyCtx();
    let leaked = false;
    let updates = 0;
    const log: Logger = {
      level: 'debug',
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: (msg: string) => {
        if (msg !== 'index updated') return;
        updates++;
        if (ctx.notes.get('race.md')?.raw.includes(OUT_TEXT)) leaked = true;
      },
    };
    race.target = note;
    race.swapIn = async () => {
      await rm(note);
      await symlink(join(outside, 'o.md'), note, 'file');
    };
    race.swapBack = async () => {
      await rm(note);
      await writeFile(note, '# Race\n\ninside again\n', 'utf8');
    };

    const { stop, ready } = startWatcher(ctx, log, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      race.armed = true;
      await writeFile(note, '# Race\n\ninside\n', 'utf8');
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        if (!race.armed && ctx.notes.get('race.md')?.raw.includes('inside again')) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(race.armed).toBe(false);
      expect(leaked).toBe(false);
      expect(updates).toBeGreaterThan(0);
      expect(ctx.notes.get('race.md')?.raw).toContain('inside again');
    } finally {
      await stop();
    }
  });
});
