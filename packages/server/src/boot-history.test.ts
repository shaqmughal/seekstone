import { type ChildProcess, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * SHA-575: boots the real server over stdio with `.seekstone` linked out of
 * the vault. The journal stores full copies of notes, so with
 * SEEKSTONE_FOLLOW_SYMLINKS off the server must turn write history off and
 * say why (stderr, list_writes, undo_write) instead of writing copies there.
 * With the opt-in on, history works and lives where the link points.
 */

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
let base: string;
let vault: string;
let outside: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'seekstone-boot-history-'));
  vault = join(base, 'vault');
  outside = join(base, 'outside');
  mkdirSync(join(vault, 'notes'), { recursive: true });
  mkdirSync(outside);
  writeFileSync(join(vault, 'notes', 'a.md'), '# A\n');
  symlinkSync(
    outside,
    join(vault, '.seekstone'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

interface Session {
  call(tool: string, args: Record<string, unknown>): Promise<string>;
  stderr(): string;
  close(): void;
}

/** A minimal MCP client over the server's newline-delimited JSON-RPC stdio. */
async function boot(env: Record<string, string>): Promise<Session> {
  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: serverDir,
    env: { ...process.env, SEEKSTONE_VAULT: vault, SEEKSTONE_LOG_LEVEL: 'error', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr?.on('data', (d: Buffer) => {
    err += d.toString();
  });
  let buf = '';
  const waiting = new Map<number, (msg: { result?: unknown; error?: unknown }) => void>();
  child.stdout?.on('data', (d: Buffer) => {
    buf += d.toString();
    for (let nl = buf.indexOf('\n'); nl !== -1; nl = buf.indexOf('\n')) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim() === '') continue;
      const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
      if (msg.id !== undefined) waiting.get(msg.id)?.(msg);
    }
  });
  let nextId = 1;
  const request = (method: string, params: unknown) =>
    new Promise<{ result?: unknown; error?: unknown }>((resolve) => {
      const id = nextId++;
      waiting.set(id, resolve);
      child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'boot-history-test', version: '0' },
  });
  child.stdin?.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
  );
  return {
    async call(tool, args) {
      const res = await request('tools/call', { name: tool, arguments: args });
      const content = (res.result as { content?: { text: string }[] } | undefined)?.content;
      return content?.[0]?.text ?? JSON.stringify(res.error);
    },
    stderr: () => err,
    close: () => {
      child.kill();
    },
  };
}

describe('write history behind a symlinked .seekstone (SHA-575)', () => {
  it('is turned off with the reason shown, and writes no copies out of the vault', async () => {
    const s = await boot({});
    try {
      const list = JSON.parse(await s.call('list_writes', {})) as {
        disabled?: boolean;
        reason?: string;
      };
      expect(list.disabled).toBe(true);
      expect(list.reason).toContain('out of the vault');
      const w = await s.call('append_note', { path: 'notes/a.md', content: 'more' });
      expect(w).not.toMatch(/^Error/);
      expect(await s.call('undo_write', {})).toContain('Write history is off');
      expect(s.stderr()).toContain('WRITE HISTORY IS OFF');
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      s.close();
    }
  }, 60_000);

  it('works with SEEKSTONE_FOLLOW_SYMLINKS=1, storing history where the link points', async () => {
    const s = await boot({ SEEKSTONE_FOLLOW_SYMLINKS: '1' });
    try {
      const w = await s.call('append_note', { path: 'notes/a.md', content: 'more' });
      expect(w).not.toMatch(/^Error/);
      const list = JSON.parse(await s.call('list_writes', {})) as { total: number };
      expect(list.total).toBe(1);
      expect(existsSync(join(outside, 'history', 'manifest.jsonl'))).toBe(true);
      expect(s.stderr()).not.toContain('WRITE HISTORY IS OFF');
    } finally {
      s.close();
    }
  }, 60_000);
});
