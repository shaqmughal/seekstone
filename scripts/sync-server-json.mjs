#!/usr/bin/env node
// Keep the two committed copies of the server's version in lockstep with
// packages/server/package.json (the source of truth):
//
//   server.json                    the Official MCP Registry manifest. The
//                                  `mcp-publisher` CLI reads it as-is, so a
//                                  stale version would regress the registry.
//   packages/server/manifest.json  the MCPB manifest. Directories and scanners
//                                  read it from the repo, so a stale version
//                                  looks like an outdated bundle (SHA-631).
//
// Modes:
//   (default)  rewrite either file in place if it has drifted.
//   --check    don't write; exit 1 if either file is out of sync (CI guard).
//
// Wired into `version-packages` (so the changesets "Version Packages" PR bumps
// both files in the same commit as package.json) and run with --check in CI.
// The logic lives in version-sync.mjs, which has the tests.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { stampManifestVersion, syncServerJson } from './version-sync.mjs';

const check = process.argv.includes('--check');

const { version } = JSON.parse(
  readFileSync(join(repoRoot, 'packages/server/package.json'), 'utf8'),
);

const files = [
  ['server.json', syncServerJson],
  ['packages/server/manifest.json', stampManifestVersion],
];

let drifted = 0;
for (const [path, sync] of files) {
  const raw = readFileSync(join(repoRoot, path), 'utf8');
  const next = sync(raw, version);
  if (next === raw) {
    console.log(`${path} already in sync (version ${version}).`);
    continue;
  }
  drifted++;
  if (check) {
    console.error(
      `${path} is out of sync with packages/server/package.json (expected version ${version}).\n` +
        'Run `node scripts/sync-server-json.mjs` (or `npm run version-packages`) and commit the result.',
    );
    continue;
  }
  writeFileSync(join(repoRoot, path), next);
  console.log(`${path} synced to version ${version}.`);
}

if (check && drifted > 0) process.exit(1);
