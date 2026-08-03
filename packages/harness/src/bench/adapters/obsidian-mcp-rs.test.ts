import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ObsidianMcpRsAdapter,
  parseRsReadPage,
  parseRsSearchHits,
  parseRsVaultList,
} from './obsidian-mcp-rs.js';

describe('parseRsSearchHits', () => {
  it('parses a typical search-vault response', () => {
    const text = JSON.stringify({
      offset: 0,
      results: [
        {
          match_count: 1,
          path: 'Beta.md',
          score: 0.506,
          snippets: [{ line: 3, text: 'More zanzibar text in beta note.' }],
          truncated: false,
        },
        {
          match_count: 1,
          path: 'Alpha.md',
          score: 0.361,
          snippets: [{ line: 8, text: 'Zanzibar content here.' }],
          truncated: false,
        },
      ],
      total: 2,
      truncated: false,
    });
    const hits = parseRsSearchHits(text);
    expect(hits).toEqual([
      { path: 'Beta.md', score: 0.506, snippet: 'More zanzibar text in beta note.' },
      { path: 'Alpha.md', score: 0.361, snippet: 'Zanzibar content here.' },
    ]);
  });

  it('returns empty on non-JSON and on missing results', () => {
    expect(parseRsSearchHits('plain text error')).toEqual([]);
    expect(parseRsSearchHits('{}')).toEqual([]);
  });

  it('tolerates hits without snippets or score', () => {
    const hits = parseRsSearchHits(JSON.stringify({ results: [{ path: 'A.md' }] }));
    expect(hits).toEqual([{ path: 'A.md', score: undefined, snippet: undefined }]);
  });
});

describe('parseRsReadPage', () => {
  it('strips the pagination banner and extracts line bounds', () => {
    const text =
      'line one\nline two\n\n[showed lines 1-400 of 12859. Call read-note again with offset=401 for the rest, or view="outline" for a map of the note.]\n';
    const page = parseRsReadPage(text);
    expect(page.content).toBe('line one\nline two\n');
    expect(page.showedEnd).toBe(400);
    expect(page.totalLines).toBe(12859);
  });

  it('returns content unchanged when there is no banner (small note)', () => {
    const page = parseRsReadPage('# Small\n\nwhole note\n');
    expect(page.content).toBe('# Small\n\nwhole note\n');
    expect(page.showedEnd).toBeUndefined();
    expect(page.totalLines).toBeUndefined();
  });

  it('recognizes the final page (end == total)', () => {
    const page = parseRsReadPage('tail lines\n[showed lines 12801-12859 of 12859.]\n');
    expect(page.content).toBe('tail lines');
    expect(page.showedEnd).toBe(12859);
    expect(page.totalLines).toBe(12859);
  });
});

describe('parseRsVaultList', () => {
  it('parses the "- name → path" line format', () => {
    const text = 'Available vaults:\n- probe-vault → /tmp/probe-vault\n- second → /home/x/v two\n';
    expect(parseRsVaultList(text)).toEqual([
      { name: 'probe-vault', path: '/tmp/probe-vault' },
      { name: 'second', path: '/home/x/v two' },
    ]);
  });

  it('returns empty for unrecognized text', () => {
    expect(parseRsVaultList('no vaults here')).toEqual([]);
  });
});

// Live test: spawns the real `npx -y obsidian-mcp-rs` binary. Opt in with
// SEEKSTONE_BENCH_LIVE=1 (needs network for the first npx download).
describe.skipIf(!process.env.SEEKSTONE_BENCH_LIVE)('ObsidianMcpRsAdapter (live)', () => {
  let vaultDir: string;
  let adapter: ObsidianMcpRsAdapter;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-mcp-rs-test-'));
    await mkdir(join(vaultDir, '.obsidian'), { recursive: true });
    await writeFile(join(vaultDir, 'note1.md'), '# One\n\nZanzibar content.\n', 'utf8');
    await writeFile(join(vaultDir, 'note2.md'), '# Two\n\nOther text.\n', 'utf8');
    adapter = await ObsidianMcpRsAdapter.build({ vaultRoot: vaultDir });
  }, 120_000);

  afterAll(async () => {
    await adapter?.close();
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('search finds the matching note and measures payload', async () => {
    const { result, payloadBytes } = await adapter.search('zanzibar');
    expect(result.map((h) => h.path)).toContain('note1.md');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('read returns raw note content', async () => {
    const { result, payloadBytes } = await adapter.read('note1.md');
    expect(result).toContain('Zanzibar content.');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('write replaces note content', async () => {
    const { payloadBytes } = await adapter.write('note2.md', '# Two\n\nreplaced\n');
    expect(payloadBytes).toBe(Buffer.byteLength('# Two\n\nreplaced\n', 'utf8'));
    const { result } = await adapter.read('note2.md');
    expect(result).toContain('replaced');
  });

  it('list returns the registered vault', async () => {
    const { result, payloadBytes } = await adapter.list();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(payloadBytes).toBeGreaterThan(0);
  });
});
