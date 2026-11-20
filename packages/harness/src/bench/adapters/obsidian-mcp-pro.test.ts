import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpSubprocess } from './mcp-subprocess.js';
import { ObsidianMcpProAdapter } from './obsidian-mcp-pro.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

const SEARCH = JSON.stringify({
  results: [
    { path: 'a.md', score: 2, excerpt: 'ex' },
    { path: 'b.md', snippet: 'sn' },
    { path: 'c.md', matches: [{ context: 'cx' }] },
    {},
  ],
});

describe('ObsidianMcpProAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: ObsidianMcpProAdapter | undefined;

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
    vi.restoreAllMocks();
    delete process.env.SEEKSTONE_OBSIDIAN_MCP_PRO_CMD;
  });

  async function build(canned: Canned): Promise<ObsidianMcpProAdapter> {
    session = useStub(canned);
    adapter = await ObsidianMcpProAdapter.build({ vaultRoot: '/tmp/vault', cmd: STUB_CMD });
    return adapter;
  }

  it('sends search_notes and maps results', async () => {
    const a = await build({ search_notes: { text: SEARCH } });
    const res = await a.search('hello');
    expect(session.calls()).toEqual([
      { name: 'search_notes', arguments: { query: 'hello', maxResults: 10 } },
    ]);
    expect(res.result).toEqual([
      { path: 'a.md', score: 2, snippet: 'ex' },
      { path: 'b.md', score: undefined, snippet: 'sn' },
      { path: 'c.md', score: undefined, snippet: 'cx' },
      { path: '', score: undefined, snippet: undefined },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
    expect(res.payloadText).toBe(SEARCH);
  });

  it('accepts a flat array and tolerates a missing results key or plain text', async () => {
    const a = await build({
      search_notes: { text: [JSON.stringify([{ path: 'x.md' }]), '{}', 'plain text'] },
    });
    expect((await a.search('x')).result).toEqual([
      { path: 'x.md', score: undefined, snippet: undefined },
    ]);
    expect((await a.search('x')).result).toEqual([]);
    expect((await a.search('x')).result).toEqual([]);
  });

  it('sends get_note with the path', async () => {
    const a = await build({ get_note: { text: 'body' } });
    const res = await a.read('d/n.md');
    expect(session.calls()).toEqual([{ name: 'get_note', arguments: { path: 'd/n.md' } }]);
    expect(res.result).toBe('body');
    expect(res.payloadBytes).toBe(4);
  });

  it('sends create_note from write and createNote', async () => {
    const a = await build({ create_note: { text: 'ok' } });
    const res = await a.write('n.md', 'héllo');
    await a.createNote('m.md', 'y');
    expect(session.calls()).toEqual([
      { name: 'create_note', arguments: { path: 'n.md', content: 'héllo' } },
      { name: 'create_note', arguments: { path: 'm.md', content: 'y' } },
    ]);
    expect(res.result).toBeUndefined();
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('sends list_notes for the root with a limit', async () => {
    const a = await build({
      list_notes: { text: JSON.stringify([{ path: 'd', isDirectory: true }, {}]) },
    });
    const res = await a.list();
    expect(session.calls()).toEqual([{ name: 'list_notes', arguments: { limit: 500 } }]);
    expect(res.result).toEqual([
      { path: 'd', isDirectory: true },
      { path: '', isDirectory: false },
    ]);
  });

  it('passes the folder to list_notes and maps a notes object', async () => {
    const a = await build({
      list_notes: { text: JSON.stringify({ notes: [{ path: 'dir/a.md' }, {}] }) },
    });
    const res = await a.list('dir');
    expect(session.calls()[0]?.arguments).toEqual({ limit: 500, folder: 'dir' });
    expect(res.result).toEqual([
      { path: 'dir/a.md', isDirectory: false },
      { path: '', isDirectory: false },
    ]);
  });

  it('maps a paths object and returns nothing for an object with neither key', async () => {
    const a = await build({
      list_notes: { text: [JSON.stringify({ paths: ['a.md', 'b.md'] }), '{}'] },
    });
    expect((await a.list()).result).toEqual([
      { path: 'a.md', isDirectory: false },
      { path: 'b.md', isDirectory: false },
    ]);
    expect((await a.list()).result).toEqual([]);
  });

  it('parses a plain-text listing one path per line', async () => {
    const a = await build({ list_notes: { text: 'a.md\n  b.md  \n\n' } });
    expect((await a.list()).result).toEqual([
      { path: 'a.md', isDirectory: false },
      { path: 'b.md', isDirectory: false },
    ]);
  });

  it('passes the vault root in OBSIDIAN_VAULT_PATH', async () => {
    await build({});
    expect(session.startup().env.OBSIDIAN_VAULT_PATH).toBe('/tmp/vault');
  });

  it('takes the command from SEEKSTONE_OBSIDIAN_MCP_PRO_CMD when no cmd is given', async () => {
    session = useStub({});
    // A space-free fake command, so the test does not depend on where node is installed.
    const spy = vi.spyOn(McpSubprocess, 'connect').mockRejectedValue(new Error('stop here'));
    process.env.SEEKSTONE_OBSIDIAN_MCP_PRO_CMD = 'fake-server --flag';
    await expect(ObsidianMcpProAdapter.build({ vaultRoot: '/tmp/v2' })).rejects.toThrow(
      'stop here',
    );
    expect(spy).toHaveBeenCalledWith(
      'obsidian-mcp-pro',
      ['fake-server', '--flag'],
      expect.objectContaining({ env: expect.objectContaining({ OBSIDIAN_VAULT_PATH: '/tmp/v2' }) }),
    );
  });

  it('throws when the server returns a tool error', async () => {
    const a = await build({ get_note: { text: 'no such note', isError: true } });
    await expect(a.read('missing.md')).rejects.toThrow('obsidian-mcp-pro get_note: no such note');
  });

  it('throws on a tool error from create_note', async () => {
    const a = await build({ create_note: { text: 'exists', isError: true } });
    await expect(a.createNote('n.md', 'x')).rejects.toThrow('obsidian-mcp-pro create_note: exists');
  });
});
