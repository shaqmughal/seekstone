import {
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
 * SHA-575, decision B (2026-11-23): write history is checked for symlinks at
 * startup only (boot-history.test.ts). A link made inside .seekstone while
 * the server runs is not detected until the next restart. That is an accepted
 * limit, outside the threat model: no Seekstone tool creates links, so only
 * the user or another local process can make one. This test pins the
 * behaviour down so a change to it is deliberate.
 */

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
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

describe('write history linked after boot (accepted limit)', () => {
  it('is not detected until restart: the journal keeps writing through the link', async () => {
    const built = await buildIndex(vault);
    const ctx: ServerContext = {
      vaultRoot: vault,
      index: built.index,
      notes: built.notes,
      generation: 0,
      backlinks: built.backlinks,
      attachments: built.attachments,
      unresolved: built.unresolved,
      policy: parseWritePolicy({}),
      journal: await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 }),
    };
    await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'one' }, log);
    // Move history out of the vault and leave a link in its place.
    const history = join(vault, '.seekstone', 'history');
    renameSync(history, join(outside, 'history'));
    symlinkSync(
      join(outside, 'history'),
      history,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const before = readdirSync(join(outside, 'history', 'blobs')).length;

    const w = await dispatch(ctx, 'append_note', { path: 'notes/a.md', content: 'two' }, log);
    expect(w.isError).toBeUndefined();
    // The new pre-image went through the link.
    expect(readdirSync(join(outside, 'history', 'blobs')).length).toBeGreaterThan(before);
    const list = await dispatch(ctx, 'list_writes', {}, log);
    expect(JSON.parse(list.content[0]?.text ?? '{}').total).toBe(2);
  });
});
