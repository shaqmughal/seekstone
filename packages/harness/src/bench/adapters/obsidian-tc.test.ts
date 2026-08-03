import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ObsidianTcAdapter,
  parseTcListEntries,
  parseTcNoteContent,
  parseTcSearchHits,
} from './obsidian-tc.js';

describe('parseTcSearchHits', () => {
  it('parses a typical search_text response', () => {
    const text = JSON.stringify({
      vault: 'main',
      mode_used: 'text',
      items: [
        { path: 'Alpha.md', score: 0.372, line: 8, col: 1, snippet: 'Zanzibar content here.' },
      ],
      total: 1,
    });
    expect(parseTcSearchHits(text)).toEqual([
      { path: 'Alpha.md', score: 0.372, snippet: 'Zanzibar content here.' },
    ]);
  });

  it('returns empty on non-JSON and on missing items', () => {
    expect(parseTcSearchHits('Error [validation_error]')).toEqual([]);
    expect(parseTcSearchHits('{}')).toEqual([]);
  });
});

describe('parseTcNoteContent', () => {
  it('extracts content from the read_note envelope', () => {
    const text = JSON.stringify({
      vault: 'main',
      path: 'Alpha.md',
      content: '# Alpha\n\nbody\n',
      frontmatter: null,
      body: '# Alpha\n\nbody\n',
      has_frontmatter: false,
      content_hash: 'abc',
      stat: { size: 15 },
    });
    expect(parseTcNoteContent(text)).toBe('# Alpha\n\nbody\n');
  });

  it('falls back to the raw text when not JSON or content missing', () => {
    expect(parseTcNoteContent('plain')).toBe('plain');
    expect(parseTcNoteContent('{"path":"x.md"}')).toBe('{"path":"x.md"}');
  });
});

describe('parseTcListEntries', () => {
  it('parses a typical list_notes response', () => {
    const text = JSON.stringify({
      vault: 'main',
      folder: '',
      notes: [
        { path: 'Alpha.md', size: 98, mtime: 1785719620926 },
        { path: 'sub/Gamma.md', size: 22, mtime: 1785719620927 },
      ],
      next_cursor: null,
      total_returned: 2,
    });
    expect(parseTcListEntries(text)).toEqual([
      { path: 'Alpha.md', isDirectory: false },
      { path: 'sub/Gamma.md', isDirectory: false },
    ]);
  });

  it('returns empty on non-JSON and on missing notes', () => {
    expect(parseTcListEntries('nope')).toEqual([]);
    expect(parseTcListEntries('{}')).toEqual([]);
  });
});

// Live test: spawns the real `npx -y obsidian-tc` binary (requires Node >= 24).
// Opt in with SEEKSTONE_BENCH_LIVE=1.
describe.skipIf(!process.env.SEEKSTONE_BENCH_LIVE)('ObsidianTcAdapter (live)', () => {
  let vaultDir: string;
  let adapter: ObsidianTcAdapter;

  beforeAll(async () => {
    // obsidian-tc's safe-write check refuses symlinked path components, and
    // macOS tmpdir() lives under /var → /private/var — resolve to the real path.
    vaultDir = await realpath(await mkdtemp(join(tmpdir(), 'seekstone-tc-test-')));
    await mkdir(join(vaultDir, '.obsidian'), { recursive: true });
    await writeFile(join(vaultDir, 'note1.md'), '# One\n\nZanzibar content.\n', 'utf8');
    await writeFile(join(vaultDir, 'note2.md'), '# Two\n\nOther text.\n', 'utf8');
    adapter = await ObsidianTcAdapter.build({ vaultRoot: vaultDir });
  }, 180_000);

  afterAll(async () => {
    await adapter?.close();
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('search finds the matching note and measures payload', async () => {
    const { result, payloadBytes } = await adapter.search('zanzibar');
    expect(result.map((h) => h.path)).toContain('note1.md');
    expect(payloadBytes).toBeGreaterThan(0);
  });

  it('read returns note content with the full envelope as payload', async () => {
    const { result, payloadBytes } = await adapter.read('note1.md');
    expect(result).toContain('Zanzibar content.');
    // Payload is the JSON envelope, strictly larger than the content alone.
    expect(payloadBytes).toBeGreaterThan(Buffer.byteLength(result, 'utf8'));
  });

  it('write creates a new note (upsert)', async () => {
    const { payloadBytes } = await adapter.write('created.md', '# Created\n');
    expect(payloadBytes).toBe(Buffer.byteLength('# Created\n', 'utf8'));
    const { result } = await adapter.read('created.md');
    expect(result).toContain('# Created');
  });

  it('list returns all notes', async () => {
    const { result, payloadBytes } = await adapter.list();
    const paths = result.map((e) => e.path);
    expect(paths).toContain('note1.md');
    expect(paths).toContain('note2.md');
    expect(payloadBytes).toBeGreaterThan(0);
  });
});
