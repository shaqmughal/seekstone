import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
