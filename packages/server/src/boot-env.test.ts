import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WRITE_TOOLS } from './dispatch.js';

/**
 * SHA-633: boots the real entry point to check that index.ts runs
 * `normalizeEnv` and `flagWarnings` before it parses settings. The unit tests
 * in env.test.ts cover the helpers; these fail if the boot code stops calling
 * them or calls them too late.
 */

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
let vault: string;

beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), 'seekstone-boot-env-'));
  mkdirSync(join(vault, 'notes'));
  writeFileSync(join(vault, 'notes', 'a.md'), '# A\n');
});

afterEach(() => {
  rmSync(vault, { recursive: true, force: true });
});

/** Boot the server, wait for the index, and return everything it logged. */
function bootLog(env: Record<string, string>): Promise<string> {
  // Drop any SEEKSTONE_* the developer has exported so only this test's
  // settings reach the server.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('SEEKSTONE_')),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: serverDir,
      env: { ...inherited, SEEKSTONE_VAULT: vault, SEEKSTONE_LOG_LEVEL: 'info', ...env },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let err = '';
    // How the test ends once the child has fully closed. Settling only on
    // `close` keeps afterEach from deleting the vault while the server is
    // still creating .seekstone/history in it.
    let settle: (() => void) | undefined;
    const stop = (then: () => void): void => {
      if (settle) return;
      clearTimeout(timer);
      settle = then;
      child.kill();
    };
    const timer = setTimeout(() => {
      stop(() => reject(new Error(`server did not finish indexing:\n${err}`)));
    }, 15_000);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`server failed to start (${e.message}):\n${err}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settle) settle();
      else reject(new Error(`server exited with code ${code} before indexing:\n${err}`));
    });
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
      if (err.includes('index ready')) {
        const log = err;
        stop(() => resolve(log));
      }
    });
  });
}

/** An unfilled MCPB placeholder: the literal text `${user_config.<key>}`. */
const ph = (key: string): string => `\${user_config.${key}}`;

describe('boot-time env handling (SHA-633)', () => {
  it('drops an unfilled read_paths placeholder before the read scope is parsed', async () => {
    const log = await bootLog({ SEEKSTONE_READ_PATHS: ph('read_paths') });
    expect(log).toContain('SEEKSTONE_READ_PATHS was the unfilled placeholder');
    // Kept as a glob, the placeholder would scope the vault to nothing.
    expect(log).not.toContain('read paths scoped');
    expect(log).toMatch(/index ready.*notes=1/);
  }, 20_000);

  it('warns about an unrecognized SEEKSTONE_READ_ONLY value', async () => {
    const log = await bootLog({ SEEKSTONE_READ_ONLY: 'y' });
    expect(log).toContain('SEEKSTONE_READ_ONLY="y" is not an on/off value');
    expect(log).toContain('read-only mode');
  }, 20_000);

  it('fails closed: SEEKSTONE_READ_ONLY=y boots read-only without write tools (SHA-635)', async () => {
    const { log, tools } = await bootTools({ SEEKSTONE_READ_ONLY: 'y' });
    expect(log).toContain(
      'SEEKSTONE_READ_ONLY="y" is not an on/off value (1/0, true/false, yes/no, on/off); turning read-only on to be safe',
    );
    expect(log).toContain('read-only mode');
    expect(tools).toContain('vault_stats');
    for (const name of WRITE_TOOLS) expect(tools).not.toContain(name);
  }, 20_000);
});

/** Boot the server as an MCP client would, and return its log and tool names. */
async function bootTools(env: Record<string, string>): Promise<{ log: string; tools: string[] }> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (e): e is [string, string] => !e[0].startsWith('SEEKSTONE_') && e[1] !== undefined,
    ),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/index.ts'],
    cwd: serverDir,
    env: { ...inherited, SEEKSTONE_VAULT: vault, SEEKSTONE_LOG_LEVEL: 'info', ...env },
    stderr: 'pipe',
  });
  let log = '';
  transport.stderr?.on('data', (d: Buffer) => {
    log += d.toString();
  });
  const client = new Client({ name: 'boot-env-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return { log, tools: tools.map((t) => t.name) };
  } finally {
    await client.close();
  }
}
