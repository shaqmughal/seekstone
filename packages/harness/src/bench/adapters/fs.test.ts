import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsAdapter } from './fs.js';

const NOTE1_CONTENT = `---
title: Alpha Note
tags: [work, project]
---
This is alpha content.
`;

const NOTE2_CONTENT = `---
title: Beta Note
---
This is beta content with some extra words.
`;

const NOTE3_CONTENT = `# Plain note
No frontmatter here.
`;

describe('FsAdapter', () => {
  let vaultDir: string;
  let adapter: FsAdapter;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-fs-adapter-test-'));
    await writeFile(join(vaultDir, 'note1.md'), NOTE1_CONTENT, 'utf8');
    await writeFile(join(vaultDir, 'note2.md'), NOTE2_CONTENT, 'utf8');
    await mkdir(join(vaultDir, 'subdir'), { recursive: true });
    await writeFile(join(vaultDir, 'subdir', 'note3.md'), NOTE3_CONTENT, 'utf8');
    adapter = await FsAdapter.build({ vaultRoot: vaultDir });
  });

  afterAll(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  describe('build', () => {
    it('does not throw and returns an adapter object', async () => {
      const a = await FsAdapter.build({ vaultRoot: vaultDir });
      expect(a).toBeDefined();
      expect(typeof a.search).toBe('function');
      expect(typeof a.read).toBe('function');
      expect(typeof a.write).toBe('function');
      expect(typeof a.list).toBe('function');
    });
  });

  describe('search', () => {
    it('search("alpha") returns >= 1 hit with path note1.md', async () => {
      const { result, payloadBytes } = await adapter.search('alpha');
      expect(result.length).toBeGreaterThanOrEqual(1);
      const paths = result.map((h) => h.path);
      expect(paths).toContain('note1.md');
      expect(payloadBytes).toBeGreaterThan(0);
    });

    it('search("beta") returns a hit with path note2.md', async () => {
      const { result } = await adapter.search('beta');
      expect(result.length).toBeGreaterThanOrEqual(1);
      const paths = result.map((h) => h.path);
      expect(paths).toContain('note2.md');
    });

    it('search("nonexistent_xyz_abc") returns 0 hits', async () => {
      const { result } = await adapter.search('nonexistent_xyz_abc');
      expect(result).toHaveLength(0);
    });

    it('payloadBytes is a positive number for hits', async () => {
      const { payloadBytes } = await adapter.search('alpha');
      expect(payloadBytes).toBeGreaterThan(0);
    });

    it('payloadBytes is >= 0 for empty results', async () => {
      const { payloadBytes } = await adapter.search('nonexistent_xyz_abc');
      expect(payloadBytes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('read', () => {
    it('read("note1.md") returns content containing "alpha content"', async () => {
      const { result, payloadBytes } = await adapter.read('note1.md');
      expect(result).toContain('alpha content');
      expect(payloadBytes).toBe(Buffer.byteLength(result, 'utf8'));
    });

    it('payloadBytes equals Buffer.byteLength of the content', async () => {
      const { result, payloadBytes } = await adapter.read('note2.md');
      expect(payloadBytes).toBe(Buffer.byteLength(result, 'utf8'));
    });

    it('throws when reading a nonexistent file', async () => {
      await expect(adapter.read('nonexistent.md')).rejects.toThrow();
    });
  });

  describe('write', () => {
    it('write("note1.md", content) updates file on disk', async () => {
      const newContent = 'new content written by test\n';
      await adapter.write('note1.md', newContent);
      const onDisk = await readFile(join(vaultDir, 'note1.md'), 'utf8');
      expect(onDisk).toBe(newContent);
    });

    it('payloadBytes equals Buffer.byteLength of written content', async () => {
      const newContent = 'another write test\n';
      const { payloadBytes } = await adapter.write('note1.md', newContent);
      expect(payloadBytes).toBe(Buffer.byteLength(newContent, 'utf8'));
    });
  });

  describe('list', () => {
    it('list() returns entries for the root including note2.md, note1.md, and subdir', async () => {
      // Restore note1.md first since write tests may have changed it
      await writeFile(join(vaultDir, 'note1.md'), NOTE1_CONTENT, 'utf8');
      const { result, payloadBytes } = await adapter.list();
      const names = result.map((e) => e.path);
      expect(names).toContain('note1.md');
      expect(names).toContain('note2.md');
      expect(names).toContain('subdir');
      expect(payloadBytes).toBeGreaterThan(0);
    });

    it('isDirectory is true for subdir, false for .md files', async () => {
      const { result } = await adapter.list();
      const subdirEntry = result.find((e) => e.path === 'subdir');
      const note1Entry = result.find((e) => e.path === 'note1.md');
      expect(subdirEntry?.isDirectory).toBe(true);
      expect(note1Entry?.isDirectory).toBe(false);
    });

    it('list("subdir") returns note3.md in that directory', async () => {
      const { result } = await adapter.list('subdir');
      const paths = result.map((e) => e.path);
      expect(paths).toContain('subdir/note3.md');
    });

    it('payloadBytes > 0 for a non-empty directory', async () => {
      const { payloadBytes } = await adapter.list();
      expect(payloadBytes).toBeGreaterThan(0);
    });
  });

  describe('searchStream', () => {
    it('yields hits for a matching query', async () => {
      const hits = [];
      for await (const hit of adapter.searchStream('alpha')) {
        hits.push(hit);
      }
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.path === 'note1.md')).toBe(true);
    });

    it('yields no hits for a non-matching query', async () => {
      const hits = [];
      for await (const hit of adapter.searchStream('xyzzyplugh42uniquegarbage')) {
        hits.push(hit);
      }
      expect(hits).toHaveLength(0);
    });

    it('results match those returned by search() for the same query', async () => {
      const streamed = [];
      for await (const hit of adapter.searchStream('beta')) {
        streamed.push(hit.path);
      }
      const { result } = await adapter.search('beta');
      const searched = result.map((h) => h.path);
      expect(streamed).toEqual(searched);
    });
  });
});
