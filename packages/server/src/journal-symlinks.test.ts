import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { Journal } from './journal.js';
import { createLogger } from './log.js';
import { parseWritePolicy } from './policy.js';

/**
 * SHA-575: write history must be a real folder. A link made after boot is
 * caught in begin() (before the first blob is written) and before undo_write
 * reads history, so nothing is written to or read from history through it.
 */

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
const MSG =
  "Error: Write not permitted: write history (.seekstone/history) goes through a symlink, and Seekstone doesn't follow symlinks.";
let base: string;
let vault: string;
let outside: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'seekstone-journal-links-'));
  vault = join(base, 'vault');
  outside = join(base, 'outside');
  mkdirSync(join(vault, 'notes'), { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(vault, 'notes', 'a.md'), '# A\n');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
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
    policy: parseWritePolicy({}),
    journal: await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 }),
  };
}

/** Move a real folder out of the vault and leave a link in its place. */
function swapForLink(rel: string[]): void {
  const at = join(vault, ...rel);
  const to = join(outside, rel.join('-'));
  renameSync(at, to);
  symlinkSync(to, at, process.platform === 'win32' ? 'junction' : 'dir');
}

describe('write history linked after boot', () => {
  it.each([[['.seekstone']], [['.seekstone', 'history']], [['.seekstone', 'history', 'blobs']]])(
    'refuses the next write and undo when %j becomes a link, touching nothing through it',
    async (rel) => {
      const ctx = await makeCtx();
      const first = await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'one' }, log);
      expect(first.isError).toBeUndefined();
      swapForLink(rel);
      const target = join(outside, rel.join('-'));
      const before = readdirSync(target, { recursive: true }).length;
      const w = await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'two' }, log);
      expect(w.content[0]?.text).toBe(MSG);
      const u = await dispatch(ctx, 'undo_write', {}, log);
      expect(u.content[0]?.text).toBe(MSG);
      expect(readdirSync(target, { recursive: true }).length).toBe(before);
    },
  );

  it('refuses when manifest.jsonl becomes a file link', async () => {
    const ctx = await makeCtx();
    await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'one' }, log);
    const manifest = join(vault, '.seekstone', 'history', 'manifest.jsonl');
    renameSync(manifest, join(outside, 'm.jsonl'));
    symlinkSync(join(outside, 'm.jsonl'), manifest, 'file');
    const w = await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'two' }, log);
    expect(w.content[0]?.text).toBe(MSG);
    expect(existsSync(join(vault, '.seekstone', 'history', 'blobs'))).toBe(true);
  });

  it('refuses list_writes when manifest.jsonl becomes a link, and shows no rows from it', async () => {
    const ctx = await makeCtx();
    await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'one' }, log);
    const manifest = join(vault, '.seekstone', 'history', 'manifest.jsonl');
    // An outside JSONL with a row that names a file the vault never had.
    writeFileSync(
      join(outside, 'm.jsonl'),
      `${JSON.stringify({ seq: 99, ts: '2026-01-01T00:00:00Z', tool: 'create_note', files: [{ path: 'outside-only.md', preHash: null, postHash: 'x' }] })}\n`,
    );
    rmSync(manifest);
    symlinkSync(join(outside, 'm.jsonl'), manifest, 'file');
    const r = await dispatch(ctx, 'list_writes', {}, log);
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toBe(MSG);
    expect(r.content[0]?.text).not.toContain('outside-only.md');
  });
});
