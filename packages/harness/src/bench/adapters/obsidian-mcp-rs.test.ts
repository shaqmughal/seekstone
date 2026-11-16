import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  ObsidianMcpRsAdapter,
  parseRsReadPage,
  parseRsSearchHits,
  parseRsVaultList,
} from './obsidian-mcp-rs.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

describe('ObsidianMcpRsAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: ObsidianMcpRsAdapter | undefined;
  const vaultRoot = '/data/my-vault';
  const VAULTS = { 'list-available-vaults': { text: `- named → ${vaultRoot}` } };
  const SEARCH = JSON.stringify({
    results: [{ path: 'B.md', score: 0.5, snippets: [{ line: 1, text: 'zz' }] }],
  });

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
  });

  async function build(canned: Canned): Promise<ObsidianMcpRsAdapter> {
    session = useStub({ ...VAULTS, ...canned });
    adapter = await ObsidianMcpRsAdapter.build({ vaultRoot, cmd: STUB_CMD });
    return adapter;
  }

  it('discovers the registered vault name from list-available-vaults', async () => {
    const a = await build({ 'search-vault': { text: SEARCH } });
    const res = await a.search('zz');
    expect(session.calls()).toEqual([
      { name: 'list-available-vaults', arguments: {} },
      { name: 'search-vault', arguments: { vault: 'named', query: 'zz' } },
    ]);
    expect(res.result).toEqual([{ path: 'B.md', score: 0.5, snippet: 'zz' }]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
  });

  it('falls back to the path basename when the vault is not listed', async () => {
    const a = await build({
      'list-available-vaults': { text: 'no vaults' },
      'search-vault': { text: SEARCH },
    });
    await a.search('zz');
    expect(session.calls()[1]?.arguments).toEqual({ vault: 'my-vault', query: 'zz' });
  });

  it('sends read-note with filename and folder split from the path', async () => {
    const a = await build({ 'read-note': { text: 'note text' } });
    const res = await a.read('dir/sub/n.md');
    expect(session.calls()[1]).toEqual({
      name: 'read-note',
      arguments: { vault: 'named', filename: 'n.md', folder: 'dir/sub' },
    });
    expect(res.result).toBe('note text');
    await a.read('top.md');
    expect(session.calls()[2]?.arguments).toEqual({ vault: 'named', filename: 'top.md' });
  });

  it('follows the pagination banner until the note is complete', async () => {
    const p1 = 'l1\nl2\n[showed lines 1-2 of 3. Call read-note again with offset=3]';
    const a = await build({ 'read-note': { text: [p1, 'l3'] } });
    const res = await a.read('n.md');
    const reads = session.calls().filter((c) => c.name === 'read-note');
    expect(reads.map((c) => c.arguments.offset)).toEqual([undefined, 3]);
    expect(res.result).toBe('l1\nl2l3');
    expect(res.payloadBytes).toBe(Buffer.byteLength(`${p1}l3`));
  });

  it('maps list-available-vaults to directory entries', async () => {
    const a = await build({});
    const res = await a.list();
    expect(res.result).toEqual([{ path: vaultRoot, isDirectory: true }]);
  });

  it('sends edit-note, delete-note and create-note', async () => {
    const a = await build({
      'edit-note': { text: 'ok' },
      'delete-note': { text: 'ok' },
      'create-note': { text: 'ok' },
    });
    const w = await a.write('d/n.md', 'héllo');
    await a.deleteNote('d/n.md');
    await a.createNote('top.md', 'x');
    expect(w.payloadBytes).toBe(Buffer.byteLength('héllo'));
    expect(session.calls().slice(1)).toEqual([
      {
        name: 'edit-note',
        arguments: {
          vault: 'named',
          filename: 'n.md',
          operation: 'replace',
          content: 'héllo',
          folder: 'd',
        },
      },
      { name: 'delete-note', arguments: { vault: 'named', filename: 'n.md', folder: 'd' } },
      { name: 'create-note', arguments: { vault: 'named', filename: 'top.md', content: 'x' } },
    ]);
  });

  it('surfaces a tool error', async () => {
    const a = await build({ 'search-vault': { text: 'bad query', isError: true } });
    await expect(a.search('x')).rejects.toThrow('obsidian-mcp-rs search-vault: bad query');
  });
});

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
