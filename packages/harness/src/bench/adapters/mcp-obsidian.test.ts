import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpObsidianAdapter, type McpObsidianAdapterOptions } from './mcp-obsidian.js';
import { McpSubprocess } from './mcp-subprocess.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

const SEARCH = JSON.stringify([
  { filename: 'a.md', result: { score: 3, matches: [{ context: 'ctx' }] } },
  {},
]);
const LIST = JSON.stringify({ files: ['dir/', 'n.md'] });

describe('McpObsidianAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: McpObsidianAdapter | undefined;

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
    vi.restoreAllMocks();
    delete process.env.SEEKSTONE_MCP_OBSIDIAN_CMD;
  });

  async function build(
    canned: Canned,
    opts: Partial<McpObsidianAdapterOptions> = {},
  ): Promise<McpObsidianAdapter> {
    session = useStub(canned);
    adapter = await McpObsidianAdapter.build({ apiKey: 'k', cmd: STUB_CMD, ...opts });
    return adapter;
  }

  it('sends obsidian_simple_search and maps REST hits', async () => {
    const a = await build({ obsidian_simple_search: { text: SEARCH } });
    const res = await a.search('hello');
    expect(session.calls()).toEqual([
      { name: 'obsidian_simple_search', arguments: { query: 'hello', context_length: 200 } },
    ]);
    expect(res.result).toEqual([
      { path: 'a.md', score: 3, snippet: 'ctx' },
      { path: '', score: undefined, snippet: undefined },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
    expect(res.payloadText).toBe(SEARCH);
  });

  it('returns no hits for a non-JSON or non-array search reply', async () => {
    const a = await build({ obsidian_simple_search: { text: ['nope', '{}'] } });
    expect((await a.search('x')).result).toEqual([]);
    expect((await a.search('x')).result).toEqual([]);
  });

  it('sends obsidian_get_file_contents and returns the text', async () => {
    const a = await build({ obsidian_get_file_contents: { text: 'body' } });
    const res = await a.read('d/n.md');
    expect(session.calls()).toEqual([
      { name: 'obsidian_get_file_contents', arguments: { filepath: 'd/n.md' } },
    ]);
    expect(res.result).toBe('body');
    expect(res.payloadBytes).toBe(4);
  });

  it('sends obsidian_put_content with the path and content', async () => {
    const a = await build({ obsidian_put_content: { text: 'ok' } });
    const res = await a.write('n.md', 'héllo');
    expect(session.calls()).toEqual([
      { name: 'obsidian_put_content', arguments: { filepath: 'n.md', content: 'héllo' } },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('lists the vault root and splits directories from files', async () => {
    const a = await build({ obsidian_list_files_in_vault: { text: LIST } });
    const res = await a.list();
    expect(session.calls()).toEqual([{ name: 'obsidian_list_files_in_vault', arguments: {} }]);
    expect(res.result).toEqual([
      { path: 'dir', isDirectory: true },
      { path: 'n.md', isDirectory: false },
    ]);
  });

  it('lists a folder with obsidian_list_files_in_dir and accepts a bare array', async () => {
    const a = await build({ obsidian_list_files_in_dir: { text: '["x.md"]' } });
    const res = await a.list('dir');
    expect(session.calls()).toEqual([
      { name: 'obsidian_list_files_in_dir', arguments: { dirpath: 'dir' } },
    ]);
    expect(res.result).toEqual([{ path: 'x.md', isDirectory: false }]);
  });

  it('returns no entries for a non-JSON list reply', async () => {
    const a = await build({ obsidian_list_files_in_vault: { text: 'oops' } });
    expect((await a.list()).result).toEqual([]);
  });

  it('passes the REST settings to the child, with defaults', async () => {
    await build({});
    expect(session.startup().env).toMatchObject({
      OBSIDIAN_API_KEY: 'k',
      OBSIDIAN_HOST: '127.0.0.1',
      OBSIDIAN_PORT: '27124',
      OBSIDIAN_PROTOCOL: 'https',
    });
  });

  it('passes explicit host, port and protocol', async () => {
    await build({}, { apiKey: 'secret', host: 'example.test', port: 1234, protocol: 'http' });
    expect(session.startup().env).toMatchObject({
      OBSIDIAN_API_KEY: 'secret',
      OBSIDIAN_HOST: 'example.test',
      OBSIDIAN_PORT: '1234',
      OBSIDIAN_PROTOCOL: 'http',
    });
  });

  it('takes the command from SEEKSTONE_MCP_OBSIDIAN_CMD when no cmd is given', async () => {
    session = useStub({});
    // A space-free fake command, so the test does not depend on where node is installed.
    const spy = vi.spyOn(McpSubprocess, 'connect').mockRejectedValue(new Error('stop here'));
    process.env.SEEKSTONE_MCP_OBSIDIAN_CMD = 'fake-server --flag';
    await expect(McpObsidianAdapter.build({ apiKey: 'k' })).rejects.toThrow('stop here');
    expect(spy).toHaveBeenCalledWith(
      'mcp-obsidian',
      ['fake-server', '--flag'],
      expect.objectContaining({ env: expect.objectContaining({ OBSIDIAN_API_KEY: 'k' }) }),
    );
  });

  it('throws when the server returns a tool error', async () => {
    const a = await build({ obsidian_get_file_contents: { text: 'no such file', isError: true } });
    await expect(a.read('missing.md')).rejects.toThrow(
      'mcp-obsidian obsidian_get_file_contents: no such file',
    );
  });
});
