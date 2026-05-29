import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { _testJoin, classify, walkVault } from './walk.js';

describe('classify', () => {
  it('classifies markdown as note', () => {
    expect(classify('Foo/bar.md')).toBe('note');
  });
  it('treats `.excalidraw.md` as note (FM + links live there)', () => {
    expect(classify('Excalidraw/Drawing.excalidraw.md')).toBe('note');
  });
  it('treats `.excalidraw` (no .md) as excalidraw', () => {
    expect(classify('Excalidraw/raw.excalidraw')).toBe('excalidraw');
  });
  it('classifies images / pdfs / canvases', () => {
    expect(classify('a.png')).toBe('image');
    expect(classify('a.PDF')).toBe('pdf');
    expect(classify('graph.canvas')).toBe('canvas');
  });
  it('falls back to other', () => {
    expect(classify('foo.xyz')).toBe('other');
  });
});

describe('walkVault', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-walk-test-'));
    await writeFile(join(tmpDir, 'note.md'), '# Hello\n');
    await writeFile(join(tmpDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await mkdir(join(tmpDir, 'sub'));
    await writeFile(join(tmpDir, 'sub', 'nested.md'), '# Nested\n');
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns all 3 entries with correct kinds and relPaths', async () => {
    const entries = await walkVault(tmpDir);
    expect(entries).toHaveLength(3);

    const byRel = Object.fromEntries(entries.map((e) => [e.relPath, e]));

    expect(byRel['note.md']?.kind).toBe('note');
    expect(byRel['image.png']?.kind).toBe('image');
    expect(byRel[join('sub', 'nested.md')]?.kind).toBe('note');
  });

  it('reports sizeBytes > 0 for each entry', async () => {
    const entries = await walkVault(tmpDir);
    for (const e of entries) {
      expect(e.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('throws or returns [] for a non-existent directory', async () => {
    const missing = join(tmpdir(), `seekstone-no-such-dir-${Date.now()}`);
    let result: Awaited<ReturnType<typeof walkVault>> | undefined;
    try {
      result = await walkVault(missing);
    } catch {
      // throwing is acceptable
      return;
    }
    expect(result).toEqual([]);
  });
});

describe('_testJoin', () => {
  it('joins path segments with the platform separator', () => {
    expect(_testJoin('a', 'b', 'c')).toBe('a/b/c');
  });
});
