import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { collectSeekstone, collectSurface, seekstoneEnv } from './collect.js';

// A minimal stdio MCP server: answers initialize (with instructions when
// FAKE_INSTRUCTIONS is set) and serves its tools over two tools/list pages.
// In seekstone mode it mirrors the real server's read-only filtering and
// reports whether the scratch vault it was given has .obsidian/.
const FAKE_SERVER = `
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const readline = require('node:readline');
const env = process.env;
const tools = [{ name: 'search', description: 'Search.' }, { name: 'list', description: 'List.' }];
if (env.SEEKSTONE_READ_ONLY !== '1') tools.push({ name: 'write_note', description: 'Write.' });
if (env.SEEKSTONE_VAULT) {
  tools.push({ name: existsSync(join(env.SEEKSTONE_VAULT, '.obsidian')) ? 'vault_ok' : 'vault_bad' });
}
if (env.SEEKSTONE_LEAKED) tools.push({ name: 'leaked' });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const req = JSON.parse(line);
  if (req.id === undefined) return;
  if (req.method === 'initialize') {
    const result = { serverInfo: { name: 'fake', version: '0.0.0' }, capabilities: { tools: {} } };
    if (env.FAKE_INSTRUCTIONS) result.instructions = env.FAKE_INSTRUCTIONS;
    if (env.FAKE_EXTRAS) Object.assign(result.capabilities, { prompts: {}, resources: {} });
    send({ jsonrpc: '2.0', id: req.id, result });
  } else if (req.method === 'prompts/list') {
    send({ jsonrpc: '2.0', id: req.id, result: { prompts: [{ name: 'daily-review' }] } });
  } else if (req.method === 'resources/list') {
    send({ jsonrpc: '2.0', id: req.id, result: { resources: [{ uri: 'obsidian://a', name: 'a' }] } });
  } else if (req.method === 'resources/templates/list') {
    send({ jsonrpc: '2.0', id: req.id, result: {} });
  } else if (req.method === 'tools/list') {
    const first = !req.params || !req.params.cursor;
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: first ? { tools: tools.slice(0, 1), nextCursor: 'p2' } : { tools: tools.slice(1) },
    });
  }
});
`;

const dir = mkdtempSync(join(tmpdir(), 'schema-tax-test-'));
const fake = join(dir, 'fake-server.cjs');
writeFileSync(fake, FAKE_SERVER);
const cmd = [process.execPath, fake];
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('collectSurface', () => {
  it('follows tools/list pagination and omits instructions when none are sent', async () => {
    const s = await collectSurface('fake', cmd, { PATH: process.env.PATH ?? '' });
    expect(s.tools.map((t) => t.name)).toEqual(['search', 'list', 'write_note']);
    expect(s).not.toHaveProperty('instructions');
  });

  it('captures the initialize instructions string', async () => {
    const s = await collectSurface('fake', cmd, { FAKE_INSTRUCTIONS: 'Prefer search.' });
    expect(s.instructions).toBe('Prefer search.');
  });

  it('skips prompt and resource lists the server does not advertise', async () => {
    const s = await collectSurface('fake', cmd, {});
    expect(s).not.toHaveProperty('prompts');
    expect(s).not.toHaveProperty('resources');
    expect(s).not.toHaveProperty('resourceTemplates');
  });

  it('reads prompts, resources and templates when the capabilities are advertised', async () => {
    const s = await collectSurface('fake', cmd, { FAKE_EXTRAS: '1' });
    expect(s.prompts).toEqual([{ name: 'daily-review' }]);
    expect(s.resources).toEqual([{ uri: 'obsidian://a', name: 'a' }]);
    expect(s.resourceTemplates).toEqual([]);
  });
});

describe('seekstoneEnv', () => {
  const base = { PATH: '/bin', HOME: '/home/x', SEEKSTONE_READ_ONLY: '1', SEEKSTONE_SEMANTIC: '1' };

  it('drops inherited SEEKSTONE_* vars and points at the scratch vault and cache', () => {
    expect(seekstoneEnv(base, 'read-write', '/v', '/c')).toEqual({
      PATH: '/bin',
      HOME: '/home/x',
      SEEKSTONE_VAULT: '/v',
      SEEKSTONE_CACHE_DIR: '/c',
    });
  });

  it('sets SEEKSTONE_READ_ONLY=1 for the read-only mode', () => {
    expect(seekstoneEnv(base, 'read-only', '/v', '/c').SEEKSTONE_READ_ONLY).toBe('1');
  });

  it('skips undefined values', () => {
    expect(seekstoneEnv({ A: undefined }, 'read-write', '/v', '/c')).not.toHaveProperty('A');
  });
});

describe('collectSeekstone', () => {
  it('runs both modes against a scratch vault with .obsidian/, isolated from the shell env', async () => {
    const served = await collectSeekstone(cmd, { ...process.env, SEEKSTONE_LEAKED: '1' });
    expect(served['read-write'].tools.map((t) => t.name)).toEqual([
      'search',
      'list',
      'write_note',
      'vault_ok',
    ]);
    expect(served['read-only'].tools.map((t) => t.name)).toEqual(['search', 'list', 'vault_ok']);
  });
});
