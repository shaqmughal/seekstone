import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpSubprocess } from '../bench/adapters/mcp-subprocess.js';
import type { SchemaTaxMode, ServedSurface } from './measure.js';

/**
 * Connect to an MCP server over stdio and read what it serves at session
 * start: the tool list, the instructions string, and the prompt and resource
 * lists when the server advertises those capabilities in `initialize`.
 */
export async function collectSurface(
  name: string,
  cmd: string[],
  env: Record<string, string>,
): Promise<ServedSurface> {
  const sub = await McpSubprocess.connect(name, cmd, { env, replaceEnv: true });
  try {
    const { instructions, capabilities } = sub.initializeResult;
    const surface: ServedSurface = { tools: await sub.listTools() };
    if (instructions) surface.instructions = instructions;
    if (capabilities?.prompts) surface.prompts = await sub.listAll('prompts/list', 'prompts');
    if (capabilities?.resources) {
      surface.resources = await sub.listAll('resources/list', 'resources');
      surface.resourceTemplates = await sub.listAll(
        'resources/templates/list',
        'resourceTemplates',
      );
    }
    return surface;
  } finally {
    await sub.close();
  }
}

/**
 * The child environment for one Seekstone run: the caller's environment minus
 * every SEEKSTONE_* variable (so a read-only or instructions setting in the
 * shell cannot skew the measurement), plus the scratch vault and cache, plus
 * SEEKSTONE_READ_ONLY=1 for the read-only mode.
 */
export function seekstoneEnv(
  base: NodeJS.ProcessEnv,
  mode: SchemaTaxMode,
  vault: string,
  cacheDir: string,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && !k.startsWith('SEEKSTONE_')) env[k] = v;
  }
  env.SEEKSTONE_VAULT = vault;
  env.SEEKSTONE_CACHE_DIR = cacheDir;
  if (mode === 'read-only') env.SEEKSTONE_READ_ONLY = '1';
  return env;
}

/**
 * Measure the built Seekstone server in both registration modes. The tool list
 * does not depend on vault content, so a one-note scratch vault keeps startup
 * fast; it carries `.obsidian/` like every harness scratch vault.
 */
export async function collectSeekstone(
  cmd: string[],
  base: NodeJS.ProcessEnv = process.env,
): Promise<Record<SchemaTaxMode, ServedSurface>> {
  const scratch = mkdtempSync(join(tmpdir(), 'seekstone-schema-tax-'));
  try {
    const vault = join(scratch, 'vault');
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, 'Note.md'), '# Note\n');
    const cacheDir = join(scratch, 'cache');
    const run = (mode: SchemaTaxMode) =>
      collectSurface('seekstone', cmd, seekstoneEnv(base, mode, vault, cacheDir));
    return { 'read-write': await run('read-write'), 'read-only': await run('read-only') };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
