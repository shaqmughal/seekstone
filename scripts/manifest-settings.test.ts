/**
 * Guard for the `.mcpb` settings (SHA-634). Every `SEEKSTONE_*` variable in the
 * env table of packages/server/README.md must be a `user_config` field in the
 * base or semantic manifest, or sit on EXCLUDED below with a reason. It also checks
 * the fields are well formed and a blank install behaves like an empty env.
 *
 * This checks README → manifest only. A variable the code reads but the README
 * doesn't list is caught by check 3 of scripts/check-docs-sync.mjs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMcpConfigForManifest, VERSIONED_MANIFEST_SCHEMAS } from '@anthropic-ai/mcpb';
import { describe, expect, it } from 'vitest';
import { resolveAuditConfig } from '../packages/server/src/audit.js';
import { normalizeEnv } from '../packages/server/src/env.js';
import { resolveInstructions } from '../packages/server/src/instructions.js';
import { resolveJournalConfig } from '../packages/server/src/journal.js';
import { createLogger } from '../packages/server/src/log.js';
import { parseWritePolicy } from '../packages/server/src/policy.js';
import { resolveSemanticConfig } from '../packages/server/src/semantic/config.js';
import { resolvePollInterval, resolveUsePolling } from '../packages/server/src/watcher.js';
import { semanticManifest } from './lib/mcpb-manifest.mjs';

type Env = Record<string, string | undefined>;
type Field = {
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
};
type Manifest = {
  server: { mcp_config: { env: Record<string, string> } };
  user_config: Record<string, Field>;
};

/** Settings a `.mcpb` user can't set, and why. */
const EXCLUDED: Record<string, string> = {
  SEEKSTONE_SEMANTIC:
    'The base bundle has no model; installing seekstone-semantic.mcpb is the opt-in and it hardwires this on.',
  SEEKSTONE_SEMANTIC_MODEL:
    'The semantic bundle ships one model; another needs a terminal download.',
  SEEKSTONE_MODEL_PATH: 'Internal to the semantic bundle.',
  SEEKSTONE_BUNDLED_MODEL_DIR: 'Internal to the semantic bundle.',
  SEEKSTONE_CACHE_DIR: 'Internal; the default location works for every install.',
};

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(root, 'packages/server', p), 'utf8');
const readme = read('README.md');
const base = JSON.parse(read('manifest.json')) as Manifest;
const semantic = semanticManifest(base) as Manifest;
const bundles = { 'seekstone.mcpb': base, 'seekstone-semantic.mcpb': semantic };

/** `SEEKSTONE_*` names from the rows of the README's env table. */
function readmeVars(text: string): string[] {
  return [...text.matchAll(/^\| `(SEEKSTONE_[A-Z0-9_]+)` \|/gm)].map((m) => m[1] as string);
}

/** README variables that are neither mapped in a manifest nor excluded. */
function unmapped(text: string, manifests: Manifest[]): string[] {
  const mapped = new Set(manifests.flatMap((m) => Object.keys(m.server.mcp_config.env)));
  return readmeVars(text).filter((v) => !mapped.has(v) && !(v in EXCLUDED));
}

/** `env` mappings to missing fields, and fields with no mapping. */
function mappingProblems(m: Manifest): string[] {
  const problems: string[] = [];
  const used = new Set<string>();
  for (const [name, value] of Object.entries(m.server.mcp_config.env)) {
    for (const [, key] of value.matchAll(/\$\{user_config\.([^}]+)\}/g)) {
      used.add(key as string);
      if (!(key in m.user_config)) problems.push(`${name} maps to missing user_config.${key}`);
    }
  }
  for (const key of Object.keys(m.user_config)) {
    if (!used.has(key)) problems.push(`user_config.${key} has no env mapping`);
  }
  return problems;
}

/** The JS type a field's default must have; other field types match their own name. */
const DEFAULT_TYPE: Record<string, string> = { file: 'string', directory: 'string' };

/** Optional fields missing a default, title or short description, or with a mistyped default. */
function fieldProblems(m: Manifest): string[] {
  const problems: string[] = [];
  for (const [key, f] of Object.entries(m.user_config)) {
    if (f.required === true) continue;
    if (f.default === undefined) problems.push(`${key}: no default`);
    else if (typeof f.default !== (DEFAULT_TYPE[f.type] ?? f.type)) {
      problems.push(`${key}: ${typeof f.default} default on a ${f.type} field`);
    }
    if (!f.title) problems.push(`${key}: no title`);
    if (!f.description) problems.push(`${key}: no description`);
    else if (f.description.length >= 200) problems.push(`${key}: description is 200+ characters`);
  }
  return problems;
}

const EXT = '/ext/seekstone';

/** The env Claude Desktop would launch a bundle with, after the server's normalizeEnv. */
async function launchEnv(m: Manifest, userConfig: Record<string, unknown>): Promise<Env> {
  const config = await getMcpConfigForManifest({
    manifest: m as never,
    extensionPath: EXT,
    systemDirs: {},
    userConfig: { vault: '/vault', ...userConfig } as never,
    pathSeparator: '/',
  });
  const env: Env = { ...config?.env };
  normalizeEnv(env);
  return env;
}

const quiet = { warn: () => {}, info: () => {} };

/** What every setting resolves to under `env`. */
function resolved(env: Env) {
  return {
    policy: parseWritePolicy(env),
    journal: resolveJournalConfig(env),
    audit: resolveAuditConfig(env),
    instructions: resolveInstructions(env, '/vault', quiet),
    logLevel: createLogger({ env, stderr: () => {} }).level,
    usePolling: resolveUsePolling(undefined, env.SEEKSTONE_WATCH_POLL),
    pollInterval: resolvePollInterval(undefined, env.SEEKSTONE_WATCH_POLL_INTERVAL),
    semantic: resolveSemanticConfig(env as NodeJS.ProcessEnv, '/home'),
  };
}

describe('every README setting has a .mcpb field (SHA-634)', () => {
  it('maps or excludes every SEEKSTONE_* variable in the README env table', () => {
    expect(readmeVars(readme).length).toBeGreaterThan(15);
    expect(unmapped(readme, [base, semantic])).toEqual([]);
  });

  it('fails when a variable is added to the README alone', () => {
    const text = readme.replace(
      '| `SEEKSTONE_VAULT` |',
      '| `SEEKSTONE_NEW_THING` | no | A new setting. |\n| `SEEKSTONE_VAULT` |',
    );
    expect(unmapped(text, [base, semantic])).toEqual(['SEEKSTONE_NEW_THING']);
  });

  it('puts semantic_weights in the semantic bundle only', () => {
    expect(base.user_config).not.toHaveProperty('semantic_weights');
    expect(base.server.mcp_config.env).not.toHaveProperty('SEEKSTONE_SEMANTIC_WEIGHTS');
    const weights = semantic.user_config.semantic_weights;
    expect([weights?.type, weights?.default]).toEqual(['string', 'int8']);
    expect(semantic.server.mcp_config.env.SEEKSTONE_SEMANTIC_WEIGHTS).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: an mcpb manifest placeholder, not a JS template.
      '${user_config.semantic_weights}',
    );
  });

  it('lists the base fields in the order the ticket gives', () => {
    expect(Object.keys(base.user_config).join(' ')).toBe(
      'vault read_only read_paths write_paths history history_max_size history_max_entries ' +
        'log_level log_file log_max_size audit_file audit_max_size instructions watch_poll watch_poll_interval',
    );
  });
});

describe.each(Object.entries(bundles))('%s manifest', (_name, m) => {
  it('passes the mcpb 0.4 schema', () => {
    const result = VERSIONED_MANIFEST_SCHEMAS['0.4'].safeParse(m);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('maps every field to env and every env placeholder to a field', () => {
    expect(mappingProblems(m)).toEqual([]);
  });

  it('gives every optional field a typed default, a title and a short description', () => {
    expect(fieldProblems(m)).toEqual([]);
  });
});

describe('the guard catches broken manifests', () => {
  it('flags a mapping to a missing field and a field with no mapping', () => {
    const m = structuredClone(base);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: an mcpb manifest placeholder, not a JS template.
    m.server.mcp_config.env.SEEKSTONE_READ_ONLY = '${user_config.readonly}';
    expect(mappingProblems(m)).toEqual([
      'SEEKSTONE_READ_ONLY maps to missing user_config.readonly',
      'user_config.read_only has no env mapping',
    ]);
  });

  it('flags a string default on a boolean field, which the mcpb schema accepts', () => {
    const m = structuredClone(base);
    m.user_config.read_only = { ...(m.user_config.read_only as Field), default: 'false' };
    expect(VERSIONED_MANIFEST_SCHEMAS['0.4'].safeParse(m).success).toBe(true);
    expect(fieldProblems(m)).toEqual(['read_only: string default on a boolean field']);
  });

  it('flags a missing default, title and long description', () => {
    const m = structuredClone(base);
    m.user_config.log_level = { type: 'string', description: 'x'.repeat(200) };
    expect(fieldProblems(m)).toEqual([
      'log_level: no default',
      'log_level: no title',
      'log_level: description is 200+ characters',
    ]);
  });
});

describe('a blank .mcpb install behaves like an empty env', () => {
  it('seekstone.mcpb', async () => {
    expect(resolved(await launchEnv(base, {}))).toEqual(resolved({}));
  });

  it('seekstone-semantic.mcpb', async () => {
    const hardwired = { SEEKSTONE_SEMANTIC: '1', SEEKSTONE_BUNDLED_MODEL_DIR: `${EXT}/model` };
    const got = resolved(await launchEnv(semantic, {}));
    expect(got.semantic).toBeDefined();
    expect(got).toEqual(resolved(hardwired));
  });
});

describe('on/off fields reach the server as booleans', () => {
  it('read_only: true turns read-only on', async () => {
    expect(parseWritePolicy(await launchEnv(base, { read_only: true })).readOnly).toBe(true);
  });

  it('history: false turns the write history off', async () => {
    expect(resolveJournalConfig(await launchEnv(base, { history: false }))).toBeUndefined();
  });

  it('watch_poll: true turns polling on', async () => {
    const env = await launchEnv(base, { watch_poll: true });
    expect(resolveUsePolling(undefined, env.SEEKSTONE_WATCH_POLL)).toBe(true);
  });
});
