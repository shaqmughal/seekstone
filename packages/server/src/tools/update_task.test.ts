import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atomicWrite } from '../atomic-write.js';
import type { ServerContext } from '../context.js';
import { buildDoc } from '../index/doc.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY, parseWritePolicy } from '../policy.js';
import { listTasks } from './list_tasks.js';
import { UpdateTaskInput, updateTask } from './update_task.js';

vi.mock('../atomic-write.js', { spy: true });

const NOTE = `---
title: Tasks
tags: [todo]
---
# Inbox

- [ ] first task
- [x] already done
  - [/] nested custom

\`\`\`
- [ ] fenced decoy
\`\`\`
`;

function buildCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot, index, notes: new Map(), backlinks: new Map(), policy: PERMISSIVE_POLICY };
}

let vaultRoot: string;

beforeEach(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-update-task-'));
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

/** Index of the single differing char between two equal-length strings, or -1. */
function singleDiffIndex(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let idx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (idx !== -1) return -1; // more than one diff
      idx = i;
    }
  }
  return idx;
}

describe('updateTask — surgical rewrite', () => {
  it('toggles open → done changing exactly one character', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await updateTask(ctx, { path: 'note.md', line: 7, state: 'x' });

    expect(result).toMatchObject({ path: 'note.md', line: 7, oldState: ' ', newState: 'x' });

    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const diffAt = singleDiffIndex(NOTE, written);
    expect(diffAt).toBeGreaterThan(-1);
    expect(NOTE[diffAt]).toBe(' ');
    expect(written[diffAt]).toBe('x');
  });

  it('preserves the frontmatter region byte-for-byte', async () => {
    const ctx = buildCtx(vaultRoot);
    await updateTask(ctx, { path: 'note.md', line: 7, state: 'x' });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const fmEnd = NOTE.indexOf('# Inbox');
    expect(written.slice(0, fmEnd)).toBe(NOTE.slice(0, fmEnd));
  });

  it('sets a custom single-char marker and toggles back', async () => {
    const ctx = buildCtx(vaultRoot);
    await updateTask(ctx, { path: 'note.md', line: 7, state: '/' });
    let written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('- [/] first task');

    await updateTask(ctx, { path: 'note.md', line: 7, state: ' ' });
    written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toBe(NOTE);
  });

  it('updates a nested task without touching its indentation', async () => {
    const ctx = buildCtx(vaultRoot);
    await updateTask(ctx, { path: 'note.md', line: 9, state: 'x' });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('  - [x] nested custom');
  });

  it('same-state call is a success no-op: no write, file untouched', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await updateTask(ctx, { path: 'note.md', line: 7, state: ' ' });
    expect(result.oldState).toBe(' ');
    expect(result.newState).toBe(' ');

    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toBe(NOTE);
  });
});

describe('updateTask — guards', () => {
  it('rejects a prose line with not_a_task, leaving the file untouched', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(updateTask(ctx, { path: 'note.md', line: 5, state: 'x' })).rejects.toThrow(
      /not_a_task/,
    );
    expect(await readFile(join(vaultRoot, 'note.md'), 'utf8')).toBe(NOTE);
  });

  it('rejects a fenced checkbox with not_a_task', async () => {
    const ctx = buildCtx(vaultRoot);
    const fencedLine = NOTE.split('\n').findIndex((l) => l.includes('fenced decoy')) + 1;
    await expect(
      updateTask(ctx, { path: 'note.md', line: fencedLine, state: 'x' }),
    ).rejects.toThrow(/not_a_task/);
  });

  it('rejects a frontmatter line with not_a_task', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(updateTask(ctx, { path: 'note.md', line: 2, state: 'x' })).rejects.toThrow(
      /not_a_task/,
    );
  });

  it('rejects an out-of-range line with line_out_of_range and lineCount', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(updateTask(ctx, { path: 'note.md', line: 999, state: 'x' })).rejects.toThrow(
      /line_out_of_range/,
    );
  });

  it('rejects a stale expectText with task_text_mismatch, no write', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      updateTask(ctx, { path: 'note.md', line: 7, expectText: 'different text', state: 'x' }),
    ).rejects.toThrow(/task_text_mismatch/);
    expect(await readFile(join(vaultRoot, 'note.md'), 'utf8')).toBe(NOTE);
  });

  it('accepts a matching expectText', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await updateTask(ctx, {
      path: 'note.md',
      line: 7,
      expectText: 'first task',
      state: 'x',
    });
    expect(result.newState).toBe('x');
  });

  it('rejects a stale prevHash with hash_conflict, no write', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      updateTask(ctx, { path: 'note.md', line: 7, state: 'x', prevHash: 'deadbeef' }),
    ).rejects.toThrow(/hash_conflict/);
    expect(await readFile(join(vaultRoot, 'note.md'), 'utf8')).toBe(NOTE);
  });

  it('schema rejects "]" and newline markers', () => {
    expect(UpdateTaskInput.safeParse({ path: 'a.md', line: 1, state: ']' }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ path: 'a.md', line: 1, state: '\n' }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ path: 'a.md', line: 1, state: 'xx' }).success).toBe(false);
    expect(UpdateTaskInput.safeParse({ path: 'a.md', line: 1, state: 'x' }).success).toBe(true);
  });

  it('respects SEEKSTONE_WRITE_PATHS scoping', async () => {
    const ctx = buildCtx(vaultRoot);
    ctx.policy = parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'journal/**' });
    await expect(updateTask(ctx, { path: 'note.md', line: 7, state: 'x' })).rejects.toThrow();
    expect(await readFile(join(vaultRoot, 'note.md'), 'utf8')).toBe(NOTE);
  });

  it('throws "Path outside vault" for path traversal', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(updateTask(ctx, { path: '../evil.md', line: 1, state: 'x' })).rejects.toThrow(
      /outside vault/i,
    );
  });
});

describe('updateTask — write-safety tripwire', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws Write-safety violation if the frontmatter region is corrupted post-write', async () => {
    const ctx = buildCtx(vaultRoot);
    // Fault injection: the tripwire branch is unreachable through the real
    // splice (the marker offset is always in the body), so corrupt the write
    // itself to prove the post-write verification actually fires.
    vi.mocked(atomicWrite).mockImplementationOnce(async (absPath: string, content: string) => {
      await writeFile(absPath, content.replace('title: Tasks', 'title: tampered'), 'utf8');
    });

    await expect(updateTask(ctx, { path: 'note.md', line: 7, state: 'x' })).rejects.toThrow(
      /Write-safety violation/,
    );
  });

  it('the tripwire stays quiet on an honest write', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(updateTask(ctx, { path: 'note.md', line: 7, state: 'x' })).resolves.toMatchObject({
      newState: 'x',
    });
    expect(vi.mocked(atomicWrite)).toHaveBeenCalled();
  });
});

describe('updateTask — cache coherence', () => {
  it('a follow-up list_tasks sees the new state', async () => {
    const ctx = buildCtx(vaultRoot);
    const doc = buildDoc('note.md', NOTE);
    ctx.notes.set('note.md', doc);
    ctx.index.add(doc);

    const before = listTasks(ctx, { path: 'note.md', state: 'open', limit: 100 });
    expect(before.tasks.map((t) => t.text)).toEqual(['first task']);

    await updateTask(ctx, { path: 'note.md', line: 7, state: 'x' });

    const after = listTasks(ctx, { path: 'note.md', state: 'open', limit: 100 });
    expect(after.tasks).toEqual([]);
    const done = listTasks(ctx, { path: 'note.md', state: 'done', limit: 100 });
    expect(done.tasks.map((t) => t.text)).toEqual(['first task', 'already done']);

    const cached = ctx.notes.get('note.md');
    expect(cached?.raw).toContain('- [x] first task');
    expect(cached?.sizeBytes).toBe(Buffer.byteLength(cached?.raw ?? '', 'utf8'));
  });
});
