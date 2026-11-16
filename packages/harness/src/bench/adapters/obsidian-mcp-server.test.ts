import { afterEach, describe, expect, it } from 'vitest';
import {
  ObsidianMcpServerAdapter,
  type ObsidianMcpServerAdapterOptions,
} from './obsidian-mcp-server.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

const SEARCH = JSON.stringify({
  result: { hits: [{ path: 'a.md', score: 2, matches: [{ context: 'ctx' }] }, {}] },
});
const LIST = JSON.stringify({ result: { notes: [{ path: 'd', isDirectory: true }, {}] } });

describe('ObsidianMcpServerAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: ObsidianMcpServerAdapter | undefined;

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
    delete process.env.SEEKSTONE_OBSIDIAN_MCP_SERVER_CMD;
  });

  async function build(
    canned: Canned,
    opts: Partial<ObsidianMcpServerAdapterOptions> = {},
  ): Promise<ObsidianMcpServerAdapter> {
    session = useStub(canned);
    adapter = await ObsidianMcpServerAdapter.build({ apiKey: 'k', cmd: STUB_CMD, ...opts });
    return adapter;
  }

  it('sends obsidian_search_notes and maps hits', async () => {
    const a = await build({ obsidian_search_notes: { text: SEARCH } });
    const res = await a.search('hello');
    expect(session.calls()).toEqual([
      {
        name: 'obsidian_search_notes',
        arguments: { mode: 'text', query: 'hello', contextLength: 200 },
      },
    ]);
    expect(res.result).toEqual([
      { path: 'a.md', score: 2, snippet: 'ctx' },
      { path: '', score: undefined, snippet: undefined },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
    expect(res.payloadText).toBe(SEARCH);
  });

  it('returns no hits for a non-JSON search reply or a missing result', async () => {
    const a = await build({ obsidian_search_notes: { text: ['nope', '{}'] } });
    expect((await a.search('x')).result).toEqual([]);
    expect((await a.search('x')).result).toEqual([]);
  });

  it('sends obsidian_get_note with a path target', async () => {
    const a = await build({ obsidian_get_note: { text: 'body' } });
    const res = await a.read('d/n.md');
    expect(session.calls()).toEqual([
      {
        name: 'obsidian_get_note',
        arguments: { format: 'content', target: { type: 'path', path: 'd/n.md' } },
      },
    ]);
    expect(res.result).toBe('body');
    expect(res.payloadBytes).toBe(4);
  });

  it('sends obsidian_write_note in overwrite mode', async () => {
    const a = await build({ obsidian_write_note: { text: 'ok' } });
    const res = await a.write('n.md', 'héllo');
    expect(session.calls()).toEqual([
      {
        name: 'obsidian_write_note',
        arguments: { target: { type: 'path', path: 'n.md' }, content: 'héllo', overwrite: true },
      },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('sends obsidian_list_notes for the root and maps notes', async () => {
    const a = await build({ obsidian_list_notes: { text: LIST } });
    const res = await a.list();
    expect(session.calls()).toEqual([{ name: 'obsidian_list_notes', arguments: { depth: 1 } }]);
    expect(res.result).toEqual([
      { path: 'd', isDirectory: true },
      { path: '', isDirectory: false },
    ]);
  });

  it('passes the folder to obsidian_list_notes and accepts a flat array', async () => {
    const a = await build({ obsidian_list_notes: { text: '[{"path":"x.md"}]' } });
    const res = await a.list('dir');
    expect(session.calls()[0]?.arguments).toEqual({ path: 'dir', depth: 1 });
    expect(res.result).toEqual([{ path: 'x.md', isDirectory: false }]);
  });

  it('returns no entries for a non-JSON list reply', async () => {
    const a = await build({ obsidian_list_notes: { text: 'oops' } });
    expect((await a.list()).result).toEqual([]);
  });

  it('passes the API key and default base URL to the child', async () => {
    await build({});
    expect(session.startup().env).toMatchObject({
      OBSIDIAN_API_KEY: 'k',
      OBSIDIAN_BASE_URL: 'https://127.0.0.1:27124',
      OBSIDIAN_VERIFY_SSL: 'false',
      MCP_TRANSPORT_TYPE: 'stdio',
    });
  });

  it('passes an explicit base URL', async () => {
    await build({}, { baseUrl: 'http://example.test:1234' });
    expect(session.startup().env.OBSIDIAN_BASE_URL).toBe('http://example.test:1234');
  });

  it('takes the command from SEEKSTONE_OBSIDIAN_MCP_SERVER_CMD when no cmd is given', async () => {
    session = useStub({});
    process.env.SEEKSTONE_OBSIDIAN_MCP_SERVER_CMD = STUB_CMD.join(' ');
    adapter = await ObsidianMcpServerAdapter.build({ apiKey: 'k' });
    expect(session.startup().env.OBSIDIAN_API_KEY).toBe('k');
  });

  it('throws when the server returns a tool error', async () => {
    const a = await build({ obsidian_get_note: { text: 'no such note', isError: true } });
    await expect(a.read('missing.md')).rejects.toThrow(
      'obsidian-mcp-server obsidian_get_note: no such note',
    );
  });
});
