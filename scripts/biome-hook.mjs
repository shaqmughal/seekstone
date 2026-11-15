#!/usr/bin/env node
// Claude Code PostToolUse hook (SHA-521): format and lint the file an agent
// just edited, so Biome problems surface while the agent can still fix them.
//
// Reads the hook payload on stdin. Exits 0 when the file is clean (or not one
// Biome checks), and 2 with Biome's output on stderr when problems remain,
// which Claude Code shows to the agent.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIOME = resolve(ROOT, 'node_modules/@biomejs/biome/bin/biome');
const CHECKED = /\.(?:[cm]?[jt]sx?|json|jsonc|css)$/;
const MAX_OUTPUT = 4000;

/**
 * The repo-relative path Biome should check, or null to skip. Skips files
 * outside the repo, types Biome doesn't handle, and paths that start with
 * `-` (they'd be read as flags).
 */
export function targetFile(payload, root = ROOT) {
  const file = payload?.tool_input?.file_path;
  if (typeof file !== 'string' || file === '') return null;
  const abs = isAbsolute(file) ? file : resolve(root, file);
  const rel = relative(root, abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  if (rel.startsWith('-') || !CHECKED.test(rel)) return null;
  return rel;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0;
  }
  const rel = targetFile(payload);
  if (!rel || !existsSync(resolve(ROOT, rel)) || !existsSync(BIOME)) return 0;

  // No shell: the path came from the agent's tool call.
  const r = spawnSync(
    process.execPath,
    [BIOME, 'check', '--write', '--no-errors-on-unmatched', '--files-ignore-unknown=true', rel],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (r.status === 0) return 0;
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(0, MAX_OUTPUT);
  process.stderr.write(`Biome found problems in ${rel} it could not fix:\n${out}\n`);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
