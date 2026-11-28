import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../../../../server/src/context.js';
import { dispatch } from '../../../../server/src/dispatch.js';
import { buildIndex } from '../../../../server/src/index/build.js';
import { createLogger } from '../../../../server/src/log.js';
import { PERMISSIVE_POLICY } from '../../../../server/src/policy.js';
import { SeekstoneAdapter } from './seekstone.js';

const NOTE1 = `---
title: Alpha Note
tags: [work, project]
---
# Alpha

This is alpha content. It links to [[note2]].

## Details

More about alpha.
`;

const NOTE2 = `---
title: Beta Note
tags: [project]
---
This is beta content with some extra words about alpha.
`;

const NOTE3 = `# Gamma
No frontmatter here, just plain text.
`;

describe('SeekstoneAdapter', () => {
  let vaultDir: string;
  let adapter: SeekstoneAdapter;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-adapter-test-'));
    await writeFile(join(vaultDir, 'note1.md'), NOTE1, 'utf8');
    await writeFile(join(vaultDir, 'note2.md'), NOTE2, 'utf8');
    await mkdir(join(vaultDir, 'subdir'), { recursive: true });
    await writeFile(join(vaultDir, 'subdir', 'note3.md'), NOTE3, 'utf8');
    adapter = await SeekstoneAdapter.build({ vaultRoot: vaultDir });
  });

  afterAll(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('builds with name/description and the Backend surface', () => {
    expect(adapter.name).toBe('seekstone');
    expect(adapter.description).toContain('in-process');
    for (const m of [
      'search',
      'read',
      'write',
      'list',
      'listTags',
      'contextPack',
      'outline',
      'getBacklinks',
      'getLinks',
    ] as const) {
      expect(typeof adapter[m]).toBe('function');
    }
  });

  it('search() returns hits with a measured payload', async () => {
    const { result, payloadBytes } = await adapter.search('alpha');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.map((h) => h.path)).toContain('note1.md');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('searchStream() yields the same hits as search()', async () => {
    const streamed: string[] = [];
    for await (const hit of adapter.searchStream('alpha')) {
      streamed.push(hit.path);
    }
    expect(streamed).toContain('note1.md');
  });

  it('read() returns file content and a byte count', async () => {
    const { result, payloadBytes } = await adapter.read('note1.md');
    expect(result).toContain('alpha content');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('read() and readMany() measure exactly what dispatch sends for read_note and read_notes', async () => {
    const { index, notes, backlinks, attachments, unresolved } = await buildIndex(vaultDir);
    const ctx: ServerContext = {
      vaultRoot: vaultDir,
      index,
      notes,
      generation: 0,
      backlinks,
      attachments,
      unresolved,
      policy: PERMISSIVE_POLICY,
    };
    const log = createLogger({ env: {}, stderr: () => {} });
    const paths = ['note1.md', 'note2.md', 'subdir/note3.md'];
    const sentText = async (tool: string, args: unknown) =>
      ((await dispatch(ctx, tool, args, log)).content[0] as { text: string }).text;

    let singleBytes = 0;
    const singleContents: string[] = [];
    for (const path of paths) {
      const r = await adapter.read(path);
      expect(r.payloadText).toBe(await sentText('read_note', { path }));
      expect(r.payloadBytes).toBe(Buffer.byteLength(r.payloadText ?? ''));
      singleBytes += r.payloadBytes;
      singleContents.push(r.result);
    }

    const batch = await adapter.readMany(paths);
    const items = paths.map((path) => ({ path }));
    expect(batch.payloadText).toBe(await sentText('read_notes', { items }));
    expect(batch.payloadBytes).toBe(Buffer.byteLength(batch.payloadText ?? ''));
    // Same notes, untruncated: the arms differ only in envelope, not content.
    const batchNotes = (batch.result as { notes: { content: string; truncated?: true }[] }).notes;
    expect(batchNotes.map((n) => n.content)).toEqual(singleContents);
    expect(batchNotes.some((n) => n.truncated)).toBe(false);
    expect(batch.payloadBytes).toBeLessThan(singleBytes);
  });

  it('readMany() passes the byte budget through and truncates to it', async () => {
    const { result } = await adapter.readMany(['note1.md', 'note2.md'], 256);
    const r = result as { budgetBytes: number; bytesUsed: number };
    expect(r.budgetBytes).toBe(256);
    expect(r.bytesUsed).toBeLessThanOrEqual(256);
  });

  it('write() persists content to the vault and reports bytes written', async () => {
    const body = '# Written\nfresh content\n';
    const { payloadBytes } = await adapter.write('written.md', body);
    expect(payloadBytes).toBe(Buffer.byteLength(body, 'utf8'));
    const onDisk = await readFile(join(vaultDir, 'written.md'), 'utf8');
    expect(onDisk).toBe(body);
  });

  it('list() enumerates notes', async () => {
    const { result, payloadBytes } = await adapter.list();
    const paths = result.map((e) => e.path);
    expect(paths).toContain('note1.md');
    expect(paths).toContain('note2.md');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('listTags() returns the tag cloud with a payload', async () => {
    const { result, payloadBytes } = await adapter.listTags();
    expect(result).toBeDefined();
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('vaultStats() returns minified counts with a measured payload', async () => {
    const { result, payloadBytes, payloadText } = await adapter.vaultStats();
    expect(result).toMatchObject({ notes: expect.any(Number) });
    expect(payloadText).toBe(JSON.stringify(result));
    expect(payloadBytes).toBe(Buffer.byteLength(payloadText ?? ''));
  });

  it('contextPack() assembles a pack within the byte budget', async () => {
    const { result, payloadBytes, payloadText } = await adapter.contextPack('alpha content', 1024);
    const pack = result as { excerpts: unknown[]; totalMatches: number; confidence: string };
    expect(pack.excerpts.length).toBeGreaterThan(0);
    expect(pack.totalMatches).toBeGreaterThan(0);
    expect(pack.confidence).toBe('high');
    expect(payloadBytes).toBeLessThanOrEqual(1024);
    expect(payloadText).toBeDefined();
  });

  it('contextPack() applies the default budget when omitted', async () => {
    const { payloadBytes } = await adapter.contextPack('alpha');
    expect(payloadBytes).toBeGreaterThan(0);
    expect(payloadBytes).toBeLessThanOrEqual(2048);
  });

  it('outline() returns a structural outline of a note', async () => {
    const { result, payloadBytes } = await adapter.outline('note1.md');
    expect(result).toBeDefined();
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('getBacklinks() finds notes linking to the target', async () => {
    const { result, payloadBytes } = await adapter.getBacklinks('note2.md');
    expect(result).toBeDefined();
    expect(payloadBytes).toBeGreaterThan(0);
    expect(JSON.stringify(result)).toContain('note1');
  });

  it('getLinks() returns the outgoing links of a note', async () => {
    const { result, payloadBytes } = await adapter.getLinks('note1.md');
    expect(result).toBeDefined();
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('readWithHash() returns content plus the server contentHash', async () => {
    const { content, hash } = await adapter.readWithHash('note1.md');
    expect(content.length).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('casWrite() with the current hash replaces; with a stale hash it conflicts', async () => {
    await adapter.write('cas-target.md', '# CAS\n\noriginal\n');
    const { hash } = await adapter.readWithHash('cas-target.md');
    await adapter.casWrite('cas-target.md', '# CAS\n\nreplaced\n', hash);
    const after = await adapter.readWithHash('cas-target.md');
    expect(after.content).toContain('replaced');
    await expect(adapter.casWrite('cas-target.md', 'never lands', hash)).rejects.toThrow(
      /hash_conflict/,
    );
  });

  it('createNote() refuses an existing path', async () => {
    await adapter.write('exists.md', 'already here');
    await expect(adapter.createNote('exists.md', 'clobber attempt')).rejects.toThrow(
      /already exists/,
    );
  });

  it('deleteNote() trashes recoverably', async () => {
    await adapter.write('doomed.md', 'trash me');
    await adapter.deleteNote('doomed.md');
    const { result } = await adapter.read('.trash/doomed.md');
    expect(result).toBe('trash me');
  });

  it('casMove() with the current hash moves; with a stale hash it conflicts', async () => {
    await adapter.write('cas-mv.md', '# CAS move\n\noriginal\n');
    const { hash } = await adapter.readWithHash('cas-mv.md');
    await adapter.casMove('cas-mv.md', 'cas-mv-dest.md', hash);
    const moved = await adapter.readWithHash('cas-mv-dest.md');
    expect(moved.content).toContain('original');
    // The move didn't change bytes, so the old hash is now stale only after a
    // fresh edit — tamper, then attempt a guarded move with the pre-edit hash.
    await adapter.write('cas-mv-dest.md', '# CAS move\n\ndrifted\n');
    await expect(adapter.casMove('cas-mv-dest.md', 'cas-mv-nope.md', hash)).rejects.toThrow(
      /hash_conflict/,
    );
  });

  it('casDelete() with the current hash deletes; with a stale hash it conflicts', async () => {
    await adapter.write('cas-del.md', '# CAS delete\n\noriginal\n');
    const { hash } = await adapter.readWithHash('cas-del.md');
    await adapter.write('cas-del.md', '# CAS delete\n\ndrifted\n');
    await expect(adapter.casDelete('cas-del.md', hash)).rejects.toThrow(/hash_conflict/);
    const fresh = await adapter.readWithHash('cas-del.md');
    await adapter.casDelete('cas-del.md', fresh.hash);
    await expect(adapter.readWithHash('cas-del.md')).rejects.toThrow();
  });
});

describe('SeekstoneAdapter.vaultStats', () => {
  it('counts recent activity from the newest note, not the wall clock', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'seekstone-adapter-stats-'));
    try {
      const day = 86_400_000;
      const newest = Date.UTC(2020, 0, 31);
      for (const [name, age] of [
        ['a.md', 0],
        ['b.md', 3],
        ['c.md', 20],
        ['d.md', 90],
      ] as const) {
        await writeFile(join(dir, name), `# ${name}\n`, 'utf8');
        const t = new Date(newest - age * day);
        await utimes(join(dir, name), t, t);
      }
      const adapter = await SeekstoneAdapter.build({ vaultRoot: dir });
      const { result } = await adapter.vaultStats();
      expect((result as { modified: unknown }).modified).toEqual({ d1: 1, d7: 2, d30: 3 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
