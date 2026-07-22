// execFileSync bypasses the shell entirely (see the note in init.ts) — these
// tests spawn the real CLI entry, not a shell line.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Black-box tests for the bin entry's help handling (SHA-263): `seekstone init
 * --help` must print init's usage and exit 0 — it must NOT enter the init run
 * path (vault auto-detection) or touch the filesystem.
 *
 * Each run gets an empty scratch HOME with no Obsidian registry and no
 * SEEKSTONE_VAULT, so if the init flow *did* run it would fail with
 * "No vault specified" and exit 1 — the assertions below would catch it.
 */

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));

let scratchHome: string;

beforeEach(() => {
  scratchHome = mkdtempSync(join(tmpdir(), 'seekstone-cli-help-'));
});

afterEach(() => {
  rmSync(scratchHome, { recursive: true, force: true });
});

function runCli(args: string[]): string {
  // Throws on non-zero exit, which fails the test — exit 0 is asserted for free.
  return execFileSync(process.execPath, ['--import', 'tsx', 'src/index.ts', ...args], {
    cwd: serverDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: scratchHome,
      APPDATA: join(scratchHome, 'AppData', 'Roaming'),
      SEEKSTONE_VAULT: undefined,
    },
  });
}

describe('seekstone init --help (subprocess)', () => {
  for (const flag of ['--help', '-h']) {
    it(`"init ${flag}" prints init usage and exits 0 without running vault detection`, () => {
      const out = runCli(['init', flag]);

      // Init's own usage, with all three flags documented.
      expect(out).toContain('seekstone init');
      expect(out).toContain('--vault');
      expect(out).toContain('--client');
      expect(out).toContain('--write');

      // No trace of the init run path (vault auto-detection / validation).
      expect(out).not.toContain('No vault specified');
      expect(out).not.toContain('Multiple Obsidian vaults');
      expect(out).not.toContain('Vault looks good');

      // Nothing was written under the scratch HOME.
      expect(readdirSync(scratchHome)).toEqual([]);
    });
  }

  it('help flags placed after other init options still win', () => {
    const out = runCli(['init', '--vault', join(scratchHome, 'nope'), '--help']);
    expect(out).toContain('--client');
    expect(out).not.toContain('does not exist');
    expect(readdirSync(scratchHome)).toEqual([]);
  });

  it('top-level --help still prints the general help', () => {
    const out = runCli(['--help']);
    expect(out).toContain('Start the MCP server');
    expect(out).toContain('seekstone init');
  });
});
