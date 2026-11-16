import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpvaultAdapter } from './mcpvault.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

const SEARCH = JSON.stringify([{ p: 'a.md', t: 'A', ex: 'hello', mc: 2, score: 1.5 }]);
const READ = JSON.stringify({ fm: { tags: ['x'] }, content: 'body text' });
const LIST = JSON.stringify({ dirs: ['sub'], files: ['n.md'] });

describe('McpvaultAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: McpvaultAdapter | undefined;
  let vault: string;

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), 'seekstone-mcpvault-'));
  });

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
    rmSync(vault, { recursive: true, force: true });
  });

  async function build(canned: Canned): Promise<McpvaultAdapter> {
    session = useStub(canned);
    adapter = await McpvaultAdapter.build({ vaultRoot: vault, cmd: STUB_CMD });
    return adapter;
  }

  it('sends search_notes and maps the abbreviated hits', async () => {
    const a = await build({ search_notes: { text: SEARCH } });
    const res = await a.search('hello');
    expect(session.calls()).toEqual([
      {
        name: 'search_notes',
        arguments: { query: 'hello', limit: 10, searchContent: true, searchFrontmatter: false },
      },
    ]);
    expect(res.result).toEqual([{ path: 'a.md', score: 1.5, snippet: 'hello' }]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
    expect(res.payloadText).toBe(SEARCH);
  });

  it('returns no hits for a non-JSON search response', async () => {
    const a = await build({ search_notes: { text: 'No results found' } });
    expect((await a.search('zzz')).result).toEqual([]);
  });

  it('sends read_note and returns the body, with the full envelope as payload', async () => {
    const a = await build({ read_note: { text: READ } });
    const res = await a.read('dir/n.md');
    expect(session.calls()).toEqual([{ name: 'read_note', arguments: { path: 'dir/n.md' } }]);
    expect(res.result).toBe('body text');
    expect(res.payloadBytes).toBe(Buffer.byteLength(READ));
  });

  it('falls back to the raw text when read_note is not JSON', async () => {
    const a = await build({ read_note: { text: 'plain' } });
    expect((await a.read('n.md')).result).toBe('plain');
  });

  it('sends list_directory and prefixes entries with the folder', async () => {
    const a = await build({ list_directory: { text: LIST } });
    const res = await a.list('Notes');
    expect(session.calls()).toEqual([{ name: 'list_directory', arguments: { path: 'Notes' } }]);
    expect(res.result).toEqual([
      { path: 'Notes/sub', isDirectory: true },
      { path: 'Notes/n.md', isDirectory: false },
    ]);
  });

  it('lists the vault root by default without a prefix', async () => {
    const a = await build({ list_directory: { text: LIST } });
    expect((await a.list()).result).toEqual([
      { path: 'sub', isDirectory: true },
      { path: 'n.md', isDirectory: false },
    ]);
    expect(session.calls()[0]?.arguments).toEqual({ path: '/' });
  });

  it('returns no entries for a non-JSON list response', async () => {
    const a = await build({ list_directory: { text: 'oops' } });
    expect((await a.list()).result).toEqual([]);
  });

  it('sends write_note in overwrite mode', async () => {
    const a = await build({ write_note: { text: 'ok' } });
    const res = await a.write('n.md', 'héllo');
    expect(session.calls()).toEqual([
      { name: 'write_note', arguments: { path: 'n.md', content: 'héllo', mode: 'overwrite' } },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('throws when the server returns a tool error', async () => {
    const a = await build({ read_note: { text: 'no such note', isError: true } });
    await expect(a.read('missing.md')).rejects.toThrow(
      'mcpvault tool read_note error: no such note',
    );
  });

  it('throws on a JSON-RPC error reply', async () => {
    const a = await build({});
    await expect(a.search('x')).rejects.toThrow('mcpvault error -32601: unknown tool');
  });
});
