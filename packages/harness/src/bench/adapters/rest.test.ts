import { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RestAdapter } from './rest.js';

const BASE = 'http://obsidian.test:27123';
const AUTH = { authorization: 'Bearer secret' };

describe('RestAdapter', () => {
  let mock: MockAgent;
  let adapter: RestAdapter;

  beforeEach(() => {
    mock = new MockAgent();
    mock.disableNetConnect();
    adapter = new RestAdapter({ baseUrl: `${BASE}/`, apiKey: 'secret', dispatcher: mock });
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('search posts the encoded query and maps hits', async () => {
    const matches = [{ match: { start: 0, end: 3 } }];
    const body = JSON.stringify([{ filename: 'a.md', score: 2, matches }, { score: 'x' }]);
    mock
      .get(BASE)
      .intercept({ path: '/search/simple/?query=a%20b%26c', method: 'POST', headers: AUTH })
      .reply(200, body);
    const res = await adapter.search('a b&c');
    expect(res.result).toEqual([
      { path: 'a.md', score: 2, snippet: JSON.stringify(matches) },
      { path: '', score: undefined, snippet: undefined },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(body));
    expect(res.payloadText).toBe(body);
  });

  it('read returns the note text and asks for markdown', async () => {
    mock
      .get(BASE)
      .intercept({
        path: '/vault/dir%20x/n%C3%B6te.md',
        method: 'GET',
        headers: { ...AUTH, accept: 'text/markdown' },
      })
      .reply(200, 'héllo');
    const res = await adapter.read('dir x/nöte.md');
    expect(res.result).toBe('héllo');
    expect(res.payloadBytes).toBe(Buffer.byteLength('héllo'));
  });

  it('write sends the raw body and reports its byte length', async () => {
    let sent = '';
    mock
      .get(BASE)
      .intercept({
        path: '/vault/new.md',
        method: 'PUT',
        headers: { ...AUTH, 'content-type': 'text/markdown' },
      })
      .reply(204, (opts) => {
        sent = Buffer.from(opts.body as Uint8Array).toString('utf8');
        return '';
      });
    const res = await adapter.write('new.md', 'é body');
    expect(sent).toBe('é body');
    expect(res.result).toBeUndefined();
    expect(res.payloadBytes).toBe(Buffer.byteLength('é body'));
  });

  it('list parses the vault root and marks directories', async () => {
    const body = JSON.stringify({ files: ['a.md', 'sub/'] });
    mock.get(BASE).intercept({ path: '/vault/', method: 'GET', headers: AUTH }).reply(200, body);
    const res = await adapter.list();
    expect(res.result).toEqual([
      { path: 'a.md', isDirectory: false },
      { path: 'sub', isDirectory: true },
    ]);
    expect(res.payloadBytes).toBe(Buffer.byteLength(body));
  });

  it('list of a subdirectory requests a trailing slash and tolerates a missing files field', async () => {
    mock.get(BASE).intercept({ path: '/vault/sub/', method: 'GET' }).reply(200, '{}');
    const res = await adapter.list('sub');
    expect(res.result).toEqual([]);
  });

  it('surfaces a non-2xx read as an error with status and body', async () => {
    mock.get(BASE).intercept({ path: '/vault/missing.md', method: 'GET' }).reply(404, 'not found');
    await expect(adapter.read('missing.md')).rejects.toThrow('read missing.md → 404: not found');
  });

  it('surfaces non-2xx search, write and list responses', async () => {
    const pool = mock.get(BASE);
    pool.intercept({ path: '/search/simple/?query=q', method: 'POST' }).reply(500, 'boom');
    pool.intercept({ path: '/vault/w.md', method: 'PUT' }).reply(401, 'nope');
    pool.intercept({ path: '/vault/', method: 'GET' }).reply(503, 'down');
    await expect(adapter.search('q')).rejects.toThrow('search q → 500: boom');
    await expect(adapter.write('w.md', 'x')).rejects.toThrow('write w.md → 401: nope');
    await expect(adapter.list()).rejects.toThrow('list  → 503: down');
  });

  it('builds its own agent when no dispatcher is given', async () => {
    const own = new RestAdapter({ baseUrl: BASE, apiKey: 'k', allowInsecureTls: false });
    expect(own.name).toBe('rest');
    await own.close();
  });
});
