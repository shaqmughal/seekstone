import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path, { dirname, join } from 'node:path';

/**
 * `seekstone init` — a guided setup helper. Validates an Obsidian vault and
 * prints (or, with --write, patches) the Claude MCP config so a user doesn't
 * have to hand-edit JSON or guess paths.
 *
 * The pure helpers (arg parsing, config-path resolution, additive merge,
 * command string) are exported and unit-tested. `runInit` wires them to the
 * filesystem and console.
 */

export interface InitOptions {
  vault?: string;
  write: boolean;
  client: 'desktop' | 'code';
}

export function parseInitArgs(argv: readonly string[]): InitOptions {
  const opts: InitOptions = { write: false, client: 'desktop' };
  // argv is everything after the `init` subcommand.
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') opts.write = true;
    else if (a === '--vault') opts.vault = argv[++i];
    else if (a === '--client') {
      const v = argv[++i];
      if (v === 'desktop' || v === 'code') opts.client = v;
    }
  }
  return opts;
}

/** The server config object that goes under `mcpServers.seekstone`. */
export function seekstoneServerConfig(vaultPath: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  return {
    command: 'npx',
    args: ['-y', 'seekstone'],
    env: { SEEKSTONE_VAULT: vaultPath },
  };
}

/** The `claude mcp add` one-liner for Claude Code. */
export function mcpAddCommand(vaultPath: string): string {
  return `claude mcp add seekstone --env SEEKSTONE_VAULT=${vaultPath} -- npx -y seekstone`;
}

/**
 * Resolve the Claude Desktop config path for a platform. Pure — takes the
 * platform and a home/APPDATA lookup so it can be tested without touching the
 * real environment.
 */
export function claudeDesktopConfigPath(
  platform: NodeJS.Platform,
  env: { home?: string; appData?: string },
): string {
  // Use the target platform's path semantics, not the host's, so the result is
  // correct in production AND deterministic in tests on any CI OS.
  if (platform === 'win32') {
    const j = path.win32.join;
    const base = env.appData ?? j(env.home ?? '', 'AppData', 'Roaming');
    return j(base, 'Claude', 'claude_desktop_config.json');
  }
  const j = path.posix.join;
  const home = env.home ?? '';
  if (platform === 'darwin') {
    return j(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  // Linux / other
  return j(home, '.config', 'Claude', 'claude_desktop_config.json');
}

type McpConfig = { mcpServers?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Additively merge the seekstone server into an existing Claude config object.
 * Never removes or alters other servers or top-level keys. Idempotent: running
 * it again with the same vault produces an identical object. Returns a new
 * object (does not mutate the input).
 */
export function mergeSeekstoneConfig(existing: McpConfig | null, vaultPath: string): McpConfig {
  const base: McpConfig = existing ? structuredClone(existing) : {};
  const servers = { ...(base.mcpServers ?? {}) };
  servers.seekstone = seekstoneServerConfig(vaultPath);
  return { ...base, mcpServers: servers };
}

export interface VaultCheck {
  ok: boolean;
  noteCount?: number;
  error?: string;
}

/** Validate that `vaultPath` looks like an Obsidian vault and count .md notes. */
export async function validateVault(vaultPath: string): Promise<VaultCheck> {
  try {
    const st = await stat(vaultPath);
    if (!st.isDirectory()) return { ok: false, error: `Not a directory: ${vaultPath}` };
  } catch {
    return { ok: false, error: `Path does not exist: ${vaultPath}` };
  }
  // An Obsidian vault has a .obsidian/ config folder.
  try {
    await access(join(vaultPath, '.obsidian'));
  } catch {
    return {
      ok: false,
      error: `No ".obsidian" folder found in ${vaultPath} — this doesn't look like an Obsidian vault. Open the folder in Obsidian once to initialize it, or pass the correct --vault path.`,
    };
  }
  return { ok: true, noteCount: await countMarkdown(vaultPath) };
}

async function countMarkdown(root: string): Promise<number> {
  let count = 0;
  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // skip .obsidian, .git, .trash
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith('.md')) count++;
    }
  }
  await walk(root);
  return count;
}

export interface InitResult {
  ok: boolean;
  /** Lines to print to stdout. */
  output: string[];
  /** Process exit code. */
  exitCode: number;
  /** Set when --write actually patched a file. */
  wrotePath?: string;
  backupPath?: string;
}

/**
 * Run the init flow. `deps` are injectable for testing (env, platform, clock).
 * Performs filesystem reads always; only writes when `opts.write` is true.
 */
export async function runInit(
  opts: InitOptions,
  deps: {
    env: Record<string, string | undefined>;
    platform: NodeJS.Platform;
    /** ISO timestamp for the backup filename (injected for determinism in tests). */
    timestamp: string;
  },
): Promise<InitResult> {
  const vaultPath = opts.vault ?? deps.env.SEEKSTONE_VAULT;
  if (!vaultPath) {
    return {
      ok: false,
      exitCode: 1,
      output: [
        'No vault specified. Pass --vault <path> or set SEEKSTONE_VAULT.',
        'Example: seekstone init --vault "/Users/you/Obsidian/My Vault"',
      ],
    };
  }

  const check = await validateVault(vaultPath);
  if (!check.ok) {
    return { ok: false, exitCode: 1, output: [`✗ ${check.error}`] };
  }

  const out: string[] = [
    `✓ Vault looks good: ${vaultPath}`,
    `  ${check.noteCount} markdown note${check.noteCount === 1 ? '' : 's'} found.`,
    '',
  ];

  if (opts.client === 'code') {
    out.push('Add to Claude Code by running:', '', `  ${mcpAddCommand(vaultPath)}`, '');
    return { ok: true, exitCode: 0, output: out };
  }

  // Claude Desktop
  const configPath = claudeDesktopConfigPath(deps.platform, {
    home: deps.env.HOME,
    appData: deps.env.APPDATA,
  });
  const block = JSON.stringify(
    { mcpServers: { seekstone: seekstoneServerConfig(vaultPath) } },
    null,
    2,
  );

  if (!opts.write) {
    out.push(
      'Add this to your Claude Desktop config:',
      `  ${configPath}`,
      '',
      block,
      '',
      'Then restart Claude Desktop. Or re-run with --write to patch it automatically.',
    );
    return { ok: true, exitCode: 0, output: out };
  }

  // --write: additive, backed-up patch.
  let existing: McpConfig | null = null;
  let existingRaw: string | null = null;
  try {
    existingRaw = await readFile(configPath, 'utf8');
    existing = JSON.parse(existingRaw) as McpConfig;
  } catch (err) {
    if (existingRaw !== null) {
      // File exists but isn't valid JSON — refuse rather than clobber.
      return {
        ok: false,
        exitCode: 1,
        output: [
          `✗ ${configPath} exists but is not valid JSON; not modifying it.`,
          `  ${err instanceof Error ? err.message : String(err)}`,
        ],
      };
    }
    existing = null; // file simply doesn't exist yet
  }

  const merged = mergeSeekstoneConfig(existing, vaultPath);
  let backupPath: string | undefined;
  await mkdir(dirname(configPath), { recursive: true });
  if (existingRaw !== null) {
    backupPath = `${configPath}.backup-${deps.timestamp}`;
    await copyFile(configPath, backupPath);
  }
  await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  out.push(
    `✓ Patched ${configPath}`,
    backupPath ? `  Backup saved to ${backupPath}` : '  (created a new config file)',
    '',
    'Restart Claude Desktop to load seekstone.',
  );
  return { ok: true, exitCode: 0, output: out, wrotePath: configPath, backupPath };
}
