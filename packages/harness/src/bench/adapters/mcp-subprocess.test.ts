import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { McpSubprocess } from './mcp-subprocess.js';

const STUB = join(dirname(fileURLToPath(import.meta.url)), 'stub-mcp-server.mjs');

const open: McpSubprocess[] = [];
async function connect(opts?: Parameters<typeof McpSubprocess.connect>[2]): Promise<McpSubprocess> {
  const sub = await McpSubprocess.connect('stub', [process.execPath, STUB], opts);
  open.push(sub);
  return sub;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => s.close()));
});

describe('McpSubprocess', () => {
  it('connect() stores the initialize result', async () => {
    const sub = await connect();
    expect(sub.initializeResult.serverInfo).toEqual({ name: 'stub', version: '9.9' });
    expect(sub.initializeResult.instructions).toBe('stub instructions');
  });

  it('connect() accepts a replaced environment', async () => {
    const sub = await connect({ env: { PATH: process.env.PATH ?? '' }, replaceEnv: true });
    expect(sub.initializeResult.serverInfo?.name).toBe('stub');
  });

  it('callTool() returns the first text item', async () => {
    const sub = await connect();
    expect(await sub.callTool('echo', {})).toBe('first');
  });

  it('callTool() throws with the server and tool name on isError', async () => {
    const sub = await connect();
    await expect(sub.callTool('fail', {})).rejects.toThrow('stub fail: boom');
  });

  it('callToolRaw() joins text items and reports the isError flag', async () => {
    const sub = await connect();
    expect(await sub.callToolRaw('echo', {})).toEqual({ text: 'first\nsecond', isError: false });
    expect(await sub.callToolRaw('fail', {})).toEqual({ text: 'boom', isError: true });
  });

  it('callToolRaw() returns isError for a reply with no result', async () => {
    const sub = await connect();
    expect(await sub.callToolRaw('empty', {})).toEqual({ text: '{}', isError: true });
  });

  it('a JSON-RPC error rejects with the server name and code', async () => {
    const sub = await connect();
    await expect(sub.callToolRaw('nope', {})).rejects.toThrow('stub -32601: unknown tool');
  });

  it('listAll() follows nextCursor across pages', async () => {
    const sub = await connect();
    const tools = await sub.listAll('tools/list', 'tools');
    expect(tools.map((t) => t.name)).toEqual(['a', 'b', 'c', 'd']);
    expect((await sub.listTools()).length).toBe(4);
  });

  it('rejects with a timeout error when the server never replies', async () => {
    const sub = await connect();
    await expect(sub.callTool('silent', {}, 50)).rejects.toThrow('stub timeout: tools/call');
  });

  it('close() rejects pending requests and resolves once the process exits', async () => {
    const sub = await connect();
    const assertion = expect(sub.callTool('silent', {})).rejects.toThrow('closed');
    await sub.close();
    await assertion;
    // A second close() would wait forever for an exit that already happened.
    open.splice(open.indexOf(sub), 1);
  });

  it('connect() rejects promptly when the child exits before initialize', async () => {
    const started = Date.now();
    await expect(
      McpSubprocess.connect('early', [process.execPath, '-e', 'process.exit(3)'], {
        initTimeout: 30_000,
      }),
    ).rejects.toThrow(/early exited with code 3/);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('rejects every pending request when the child exits after initialize', async () => {
    const sub = await connect();
    const started = Date.now();
    const silent = sub.callTool('silent', {});
    const exit = sub.callTool('exit', {});
    await expect(exit).rejects.toThrow(/stub exited with code 7/);
    await expect(silent).rejects.toThrow(/stub exited with code 7/);
    expect(Date.now() - started).toBeLessThan(2_000);
    // Requests sent after the exit fail at once instead of timing out.
    await expect(sub.callTool('echo', {})).rejects.toThrow(/stub exited with code 7/);
  });

  it('connect() rejects with the server and command when the binary is missing', async () => {
    const bin = 'seekstone-no-such-binary';
    await expect(
      McpSubprocess.connect('missing', [bin, '--flag'], { initTimeout: 30_000 }),
    ).rejects.toThrow(/missing failed to start `seekstone-no-such-binary --flag`.*ENOENT/);
  });
});
