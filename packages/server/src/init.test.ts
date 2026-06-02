import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claudeDesktopConfigPath,
  mcpAddCommand,
  mergeSeekstoneConfig,
  obsidianRegistryPath,
  parseInitArgs,
  parseObsidianVaults,
  runInit,
  seekstoneServerConfig,
  validateVault,
} from './init.js';

describe('parseInitArgs', () => {
  it('defaults: no write, desktop client', () => {
    expect(parseInitArgs([])).toEqual({ write: false, client: 'desktop' });
  });
  it('parses --vault, --write, --client', () => {
    expect(parseInitArgs(['--vault', '/v', '--write', '--client', 'code'])).toEqual({
      vault: '/v',
      write: true,
      client: 'code',
    });
  });
  it('ignores an invalid --client value (keeps default)', () => {
    expect(parseInitArgs(['--client', 'nonsense']).client).toBe('desktop');
  });
});

describe('claudeDesktopConfigPath', () => {
  it('macOS', () => {
    expect(claudeDesktopConfigPath('darwin', { home: '/Users/x' })).toBe(
      '/Users/x/Library/Application Support/Claude/claude_desktop_config.json',
    );
  });
  it('linux', () => {
    expect(claudeDesktopConfigPath('linux', { home: '/home/x' })).toBe(
      '/home/x/.config/Claude/claude_desktop_config.json',
    );
  });
  it('windows uses APPDATA', () => {
    expect(
      claudeDesktopConfigPath('win32', { appData: 'C:\\Users\\x\\AppData\\Roaming' }),
    ).toContain('Claude');
  });
});

describe('mcpAddCommand / seekstoneServerConfig', () => {
  it('mcpAddCommand embeds the vault path', () => {
    expect(mcpAddCommand('/my/vault')).toBe(
      'claude mcp add seekstone --env SEEKSTONE_VAULT=/my/vault -- npx -y seekstone',
    );
  });
  it('server config uses npx -y seekstone and the vault env', () => {
    expect(seekstoneServerConfig('/v')).toEqual({
      command: 'npx',
      args: ['-y', 'seekstone'],
      env: { SEEKSTONE_VAULT: '/v' },
    });
  });
});

describe('mergeSeekstoneConfig', () => {
  it('adds seekstone to an empty/null config', () => {
    const merged = mergeSeekstoneConfig(null, '/v');
    expect(merged.mcpServers?.seekstone).toEqual(seekstoneServerConfig('/v'));
  });
  it('preserves other servers and top-level keys', () => {
    const existing = {
      theme: 'dark',
      mcpServers: { other: { command: 'foo' } },
    };
    const merged = mergeSeekstoneConfig(existing, '/v');
    expect(merged.theme).toBe('dark');
    expect((merged.mcpServers as Record<string, unknown>).other).toEqual({ command: 'foo' });
    expect((merged.mcpServers as Record<string, unknown>).seekstone).toBeDefined();
  });
  it('does not mutate the input', () => {
    const existing = { mcpServers: { other: { command: 'foo' } } };
    mergeSeekstoneConfig(existing, '/v');
    expect(existing.mcpServers).toEqual({ other: { command: 'foo' } });
  });
  it('is idempotent', () => {
    const once = mergeSeekstoneConfig(null, '/v');
    const twice = mergeSeekstoneConfig(once, '/v');
    expect(twice).toEqual(once);
  });
});

describe('obsidianRegistryPath', () => {
  it('macOS', () => {
    expect(obsidianRegistryPath('darwin', { home: '/Users/x' })).toBe(
      '/Users/x/Library/Application Support/obsidian/obsidian.json',
    );
  });
  it('linux', () => {
    expect(obsidianRegistryPath('linux', { home: '/home/x' })).toBe(
      '/home/x/.config/obsidian/obsidian.json',
    );
  });
  it('windows uses APPDATA', () => {
    expect(obsidianRegistryPath('win32', { appData: 'C:\\Users\\x\\AppData\\Roaming' })).toContain(
      'obsidian\\obsidian.json',
    );
  });
});

describe('parseObsidianVaults', () => {
  it('returns empty array for malformed JSON', () => {
    expect(parseObsidianVaults('not json')).toEqual([]);
  });
  it('returns empty array for empty string', () => {
    expect(parseObsidianVaults('')).toEqual([]);
  });
  it('returns empty array when vaults key is missing', () => {
    expect(parseObsidianVaults(JSON.stringify({}))).toEqual([]);
  });
  it('returns empty array when vaults is empty object', () => {
    expect(parseObsidianVaults(JSON.stringify({ vaults: {} }))).toEqual([]);
  });
  it('parses a typical registry with one vault', () => {
    const json = JSON.stringify({
      vaults: { abc123: { path: '/Users/x/Notes', ts: 1000 } },
    });
    expect(parseObsidianVaults(json)).toEqual([{ path: '/Users/x/Notes', open: false }]);
  });
  it('sorts open vault first, then lexically', () => {
    const json = JSON.stringify({
      vaults: {
        a: { path: '/z/vault', open: false },
        b: { path: '/a/vault', open: true },
        c: { path: '/m/vault', open: false },
      },
    });
    const result = parseObsidianVaults(json);
    const [r0, r1, r2] = result;
    expect(r0?.path).toBe('/a/vault');
    expect(r0?.open).toBe(true);
    expect(r1?.path).toBe('/m/vault');
    expect(r2?.path).toBe('/z/vault');
  });
  it('tolerates entries without an open field', () => {
    const json = JSON.stringify({ vaults: { x: { path: '/v' } } });
    const result = parseObsidianVaults(json);
    expect(result).toEqual([{ path: '/v', open: false }]);
  });
});

describe('validateVault', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'seekstone-init-vault-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts a folder with .obsidian and counts notes', async () => {
    await mkdir(join(dir, '.obsidian'), { recursive: true });
    await mkdir(join(dir, 'Sub'), { recursive: true });
    await writeFile(join(dir, 'a.md'), '# A');
    await writeFile(join(dir, 'Sub', 'b.md'), '# B');
    await writeFile(join(dir, 'note.txt'), 'not markdown');
    const res = await validateVault(dir);
    expect(res.ok).toBe(true);
    expect(res.noteCount).toBe(2);
  });

  it('rejects a folder without .obsidian', async () => {
    const res = await validateVault(dir);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('.obsidian');
  });

  it('rejects a non-existent path', async () => {
    const res = await validateVault(join(dir, 'nope'));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('does not exist');
  });
});

describe('runInit', () => {
  let dir: string;
  let vault: string;
  let home: string;
  const TS = '2026-05-31T00-00-00-000Z';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'seekstone-init-run-'));
    vault = join(dir, 'vault');
    home = join(dir, 'home');
    await mkdir(join(vault, '.obsidian'), { recursive: true });
    await writeFile(join(vault, 'a.md'), '# A');
    await mkdir(home, { recursive: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const deps = (over: Partial<Record<string, string>> = {}) => ({
    env: { HOME: home, ...over } as Record<string, string | undefined>,
    platform: 'darwin' as NodeJS.Platform,
    timestamp: TS,
  });

  it('errors with exit 1 when no vault is given', async () => {
    const res = await runInit({ write: false, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(1);
    expect(res.output.join('\n')).toContain('No vault specified');
  });

  it('errors with exit 1 for a non-vault directory', async () => {
    const res = await runInit({ vault: home, write: false, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(1);
    expect(res.output.join('\n')).toContain('.obsidian');
  });

  it('prints the config block (no write) for desktop', async () => {
    const res = await runInit({ vault, write: false, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(0);
    expect(res.wrotePath).toBeUndefined();
    const text = res.output.join('\n');
    expect(text).toContain('mcpServers');
    expect(text).toContain(vault);
  });

  it('prints the claude mcp add command for code client', async () => {
    const res = await runInit({ vault, write: false, client: 'code' }, deps());
    expect(res.output.join('\n')).toContain('claude mcp add seekstone');
  });

  it('--write --client code calls spawnClaudeMcp with correct args', async () => {
    const calls: string[][] = [];
    const spawnClaudeMcp = (args: string[]) => {
      calls.push(args);
      return { ok: true };
    };
    const res = await runInit(
      { vault, write: true, client: 'code' },
      { ...deps(), spawnClaudeMcp },
    );
    expect(res.exitCode).toBe(0);
    expect(res.ranClaudeMcpAdd).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'mcp',
      'add',
      'seekstone',
      '--env',
      `SEEKSTONE_VAULT=${vault}`,
      '--',
      'npx',
      '-y',
      'seekstone',
    ]);
    expect(res.output.join('\n')).toContain('seekstone added to Claude Code');
  });

  it('--write --client code falls back gracefully when claude is not on PATH', async () => {
    const spawnClaudeMcp = (_args: string[]) => ({ ok: false, error: 'command not found: claude' });
    const res = await runInit(
      { vault, write: true, client: 'code' },
      { ...deps(), spawnClaudeMcp },
    );
    expect(res.exitCode).toBe(1);
    expect(res.ranClaudeMcpAdd).toBeUndefined();
    const text = res.output.join('\n');
    expect(text).toContain('Could not run');
    expect(text).toContain('claude mcp add seekstone');
  });

  it('--write creates a new config when none exists', async () => {
    const res = await runInit({ vault, write: true, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(0);
    expect(res.wrotePath).toBeDefined();
    expect(res.backupPath).toBeUndefined();
    const written = JSON.parse(await readFile(res.wrotePath as string, 'utf8'));
    expect(written.mcpServers.seekstone.env.SEEKSTONE_VAULT).toBe(vault);
  });

  it('--write merges into an existing config and backs it up', async () => {
    const cfgPath = claudeDesktopConfigPath('darwin', { home });
    await mkdir(join(home, 'Library', 'Application Support', 'Claude'), { recursive: true });
    await writeFile(cfgPath, JSON.stringify({ mcpServers: { other: { command: 'x' } } }, null, 2));

    const res = await runInit({ vault, write: true, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(0);
    expect(res.backupPath).toBeDefined();
    // Backup preserves the original.
    const backup = JSON.parse(await readFile(res.backupPath as string, 'utf8'));
    expect(backup.mcpServers.other).toEqual({ command: 'x' });
    // New config keeps `other` AND adds seekstone.
    const written = JSON.parse(await readFile(cfgPath, 'utf8'));
    expect(written.mcpServers.other).toEqual({ command: 'x' });
    expect(written.mcpServers.seekstone).toBeDefined();
  });

  it('--write refuses to clobber a malformed existing config', async () => {
    const cfgPath = claudeDesktopConfigPath('darwin', { home });
    await mkdir(join(home, 'Library', 'Application Support', 'Claude'), { recursive: true });
    await writeFile(cfgPath, '{ not valid json');
    const res = await runInit({ vault, write: true, client: 'desktop' }, deps());
    expect(res.exitCode).toBe(1);
    expect(res.output.join('\n')).toContain('not valid JSON');
    // Original left untouched.
    expect(await readFile(cfgPath, 'utf8')).toBe('{ not valid json');
  });

  it('--write is idempotent (re-running keeps a single seekstone entry)', async () => {
    await runInit({ vault, write: true, client: 'desktop' }, deps());
    const res2 = await runInit({ vault, write: true, client: 'desktop' }, deps());
    const written = JSON.parse(await readFile(res2.wrotePath as string, 'utf8'));
    expect(Object.keys(written.mcpServers)).toEqual(['seekstone']);
  });

  // Auto-detect tests via injected readFile
  const makeRegistry = (vaults: Record<string, { path: string; open?: boolean }>) =>
    JSON.stringify({ vaults });

  it('auto-detects a single vault when --vault is omitted', async () => {
    const registry = makeRegistry({ a: { path: vault, open: true } });
    const res = await runInit(
      { write: false, client: 'desktop' },
      { ...deps(), readFile: async () => registry },
    );
    expect(res.exitCode).toBe(0);
    expect(res.output.join('\n')).toContain(vault);
  });

  it('lists multiple vaults and exits 1 when more than one is found', async () => {
    const registry = makeRegistry({
      a: { path: vault },
      b: { path: '/other/vault' },
    });
    const res = await runInit(
      { write: false, client: 'desktop' },
      { ...deps(), readFile: async () => registry },
    );
    expect(res.exitCode).toBe(1);
    const text = res.output.join('\n');
    expect(text).toContain('Multiple Obsidian vaults');
    expect(text).toContain('--vault');
  });

  it('falls back to No vault specified when registry is missing', async () => {
    const res = await runInit(
      { write: false, client: 'desktop' },
      {
        ...deps(),
        readFile: async () => {
          throw new Error('ENOENT');
        },
      },
    );
    expect(res.exitCode).toBe(1);
    expect(res.output.join('\n')).toContain('No vault specified');
  });

  it('--vault takes precedence over auto-detect', async () => {
    const registry = makeRegistry({ a: { path: '/other/vault' } });
    const res = await runInit(
      { vault, write: false, client: 'desktop' },
      { ...deps(), readFile: async () => registry },
    );
    expect(res.exitCode).toBe(0);
    expect(res.output.join('\n')).toContain(vault);
    expect(res.output.join('\n')).not.toContain('/other/vault');
  });

  it('SEEKSTONE_VAULT takes precedence over auto-detect', async () => {
    const registry = makeRegistry({ a: { path: '/other/vault' } });
    const res = await runInit(
      { write: false, client: 'desktop' },
      { ...deps({ SEEKSTONE_VAULT: vault }), readFile: async () => registry },
    );
    expect(res.exitCode).toBe(0);
    expect(res.output.join('\n')).toContain(vault);
  });

  it('auto-detected path that fails validateVault reports vault error', async () => {
    const registry = makeRegistry({ a: { path: home } }); // home has no .obsidian
    const res = await runInit(
      { write: false, client: 'desktop' },
      { ...deps(), readFile: async () => registry },
    );
    expect(res.exitCode).toBe(1);
    expect(res.output.join('\n')).toContain('.obsidian');
  });
});
