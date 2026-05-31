import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { createLogger } from './log.js';

/**
 * Enforces the core promise: the server makes NO outbound network connections.
 * We replace Node's connection primitives with throwing stubs, then exercise
 * the real startup + tool paths. If any of them tries to open a socket, the
 * stub throws and the test fails.
 */

const NET_ERROR = 'NETWORK BLOCKED: the server must not make outbound connections';
const log = createLogger({ env: {}, stderr: () => {} });

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-nonet-'));
  await writeFile(
    join(vaultRoot, 'a.md'),
    '---\ntitle: A\ntags: [x]\n---\n# A\nhello world\n',
    'utf8',
  );
  await writeFile(join(vaultRoot, 'b.md'), '# B\nmore text linking [[A]]\n', 'utf8');
  const built = await buildIndex(vaultRoot);
  ctx = { vaultRoot, index: built.index, notes: built.notes };
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

beforeEach(() => {
  const block = (() => {
    throw new Error(NET_ERROR);
  }) as never;
  // Cover the primitives every Node network path bottoms out in.
  vi.spyOn(net, 'connect').mockImplementation(block);
  vi.spyOn(net, 'createConnection').mockImplementation(block);
  vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(block);
  vi.spyOn(http, 'request').mockImplementation(block);
  vi.spyOn(https, 'request').mockImplementation(block);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the server makes no outbound network calls', () => {
  it('the network primitives are actually blocked (guard sanity check)', () => {
    expect(() => net.connect(80, 'example.com')).toThrow(NET_ERROR);
    expect(() => http.request('http://example.com')).toThrow(NET_ERROR);
    expect(() => https.request('https://example.com')).toThrow(NET_ERROR);
  });

  it('building the index touches no network', async () => {
    await expect(buildIndex(vaultRoot)).resolves.toBeDefined();
  });

  it('every tool runs without opening a connection', async () => {
    const calls: Array<[string, unknown]> = [
      ['search', { query: 'hello' }],
      ['read_note', { path: 'a.md' }],
      ['list_notes', {}],
      ['create_note', { path: 'new.md', content: 'x' }],
      ['append_note', { path: 'a.md', content: 'more' }],
      ['patch_frontmatter', { path: 'a.md', patch: { status: 'done' } }],
      ['move_note', { from: 'new.md', to: 'moved.md' }],
      ['delete_note', { path: 'moved.md' }],
    ];
    for (const [name, args] of calls) {
      const res = await dispatch(ctx, name, args, log);
      // A tool may legitimately error, but never because the network was hit.
      const text = res.content.map((c) => c.text).join('\n');
      expect(text).not.toContain(NET_ERROR);
    }
  });
});
