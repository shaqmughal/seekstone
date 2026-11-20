import { afterEach, describe, expect, it } from 'vitest';
import { ObsidianMcpAdapter } from './obsidian-mcp.js';
import { type Canned, STUB_CMD, type StubSession, useStub } from './stub-canned.js';

const ROOT = '/tmp/My Vault_1';
const NAME = 'my-vault-1';
const SEARCH = JSON.stringify([
  { path: 'a.md', excerpt: 'ex', score: 3 },
  { filename: 'b.md', context: 'cx' },
  {},
]);
const VAULTS = JSON.stringify({ vaults: [{ name: 'v1' }, { path: '/p' }, {}] });

describe('ObsidianMcpAdapter against the stub server', () => {
  let session: StubSession;
  let adapter: ObsidianMcpAdapter | undefined;

  afterEach(async () => {
    await adapter?.close();
    adapter = undefined;
    session.dispose();
    delete process.env.SEEKSTONE_OBSIDIAN_MCP_CMD;
  });

  async function build(canned: Canned, vaultRoot = ROOT): Promise<ObsidianMcpAdapter> {
    session = useStub(canned);
    adapter = await ObsidianMcpAdapter.build({ vaultRoot, cmd: STUB_CMD });
    return adapter;
  }

  it('sends search-vault and maps hits', async () => {
    const a = await build({ 'search-vault': { text: SEARCH } });
    const res = await a.search('hello');
    expect(session.calls()).toEqual([
      {
        name: 'search-vault',
        arguments: { vault: NAME, query: 'hello', searchType: 'content' },
      },
    ]);
    expect(res.result).toEqual([
      { path: 'a.md', score: 3, snippet: 'ex' },
      { path: 'b.md', score: undefined, snippet: 'cx' },
      { path: '', score: undefined, snippet: undefined },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(SEARCH));
    expect(res.payloadText).toBe(SEARCH);
  });

  it('returns no hits for a plain-text or non-array search reply', async () => {
    const a = await build({ 'search-vault': { text: ['plain text', '{}'] } });
    expect((await a.search('x')).result).toEqual([]);
    expect((await a.search('x')).result).toEqual([]);
  });

  it('sends read-note with the filename and folder split', async () => {
    const a = await build({ 'read-note': { text: 'body' } });
    const res = await a.read('d/e/n.md');
    expect(session.calls()).toEqual([
      { name: 'read-note', arguments: { vault: NAME, filename: 'n.md', folder: 'd/e' } },
    ]);
    expect(res.result).toBe('body');
    expect(res.payloadBytes).toBe(4);
  });

  it('omits the folder for a root-level note', async () => {
    const a = await build({ 'read-note': { text: 'body' } });
    await a.read('n.md');
    expect(session.calls()[0]?.arguments).toEqual({ vault: NAME, filename: 'n.md' });
  });

  it('sends edit-note in replace mode', async () => {
    const a = await build({ 'edit-note': { text: 'ok' } });
    const res = await a.write('d/n.md', 'héllo');
    expect(session.calls()).toEqual([
      {
        name: 'edit-note',
        arguments: {
          vault: NAME,
          filename: 'n.md',
          operation: 'replace',
          content: 'héllo',
          folder: 'd',
        },
      },
    ]);
    expect(res.result).toBeUndefined();
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('omits the folder when writing a root-level note', async () => {
    const a = await build({ 'edit-note': { text: 'ok' } });
    await a.write('n.md', 'x');
    expect(session.calls()[0]?.arguments).toEqual({
      vault: NAME,
      filename: 'n.md',
      operation: 'replace',
      content: 'x',
    });
  });

  it('sends list-available-vaults and maps vaults to directories', async () => {
    const a = await build({ 'list-available-vaults': { text: VAULTS } });
    const res = await a.list('ignored');
    expect(session.calls()).toEqual([{ name: 'list-available-vaults', arguments: {} }]);
    expect(res.result).toEqual([
      { path: 'v1', isDirectory: true },
      { path: '/p', isDirectory: true },
      { path: '', isDirectory: true },
    ]);
    expect(res.payloadText).toBe(VAULTS);
  });

  it('accepts a flat array of vaults', async () => {
    const a = await build({ 'list-available-vaults': { text: JSON.stringify([{ name: 'v' }]) } });
    expect((await a.list()).result).toEqual([{ path: 'v', isDirectory: true }]);
  });

  it('falls back to the vault name for a non-JSON list reply', async () => {
    const a = await build({ 'list-available-vaults': { text: 'Available vaults: x' } });
    expect((await a.list()).result).toEqual([{ path: NAME, isDirectory: true }]);
  });

  it('sanitizes the vault name from the last path component', async () => {
    const a = await build({ 'read-note': { text: 'b' } }, '/');
    await a.read('n.md');
    expect(session.calls()[0]?.arguments.vault).toBe('vault');
  });

  it('appends the vault root to the command', async () => {
    await build({});
    expect(session.startup().argv).toEqual([ROOT]);
  });

  it('takes the command from SEEKSTONE_OBSIDIAN_MCP_CMD when no cmd is given', async () => {
    session = useStub({});
    process.env.SEEKSTONE_OBSIDIAN_MCP_CMD = STUB_CMD.join(' ');
    adapter = await ObsidianMcpAdapter.build({ vaultRoot: '/tmp/v' });
    expect(session.startup().argv).toEqual(['/tmp/v']);
  });

  it('throws when the server returns a tool error', async () => {
    const a = await build({ 'read-note': { text: 'no such note', isError: true } });
    await expect(a.read('missing.md')).rejects.toThrow('obsidian-mcp read-note: no such note');
  });
});
