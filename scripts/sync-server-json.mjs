#!/usr/bin/env node
// Keep server.json (the Official MCP Registry manifest) in lockstep with the
// published npm versions. `server.json` is the source the `mcp-publisher` CLI
// reads, so its `version` and each `packages[].version` must match the package
// they describe — otherwise a manual `mcp-publisher publish` would push a stale
// version and regress the registry.
//
// Source of truth: the server package's package.json `version`.
//   .version                          ← packages/server  (the `seekstone` package)
//   packages[id="seekstone"]          ← packages/server
//
// Modes:
//   (default)  rewrite server.json in place if it has drifted.
//   --check    don't write; exit 1 if server.json is out of sync (CI guard).
//
// Wired into `version-packages` (so the changesets "Version Packages" PR bumps
// server.json in the same commit) and run with --check in CI.

import { readFileSync, writeFileSync } from 'node:fs';

const repoRoot = new URL('..', import.meta.url).pathname;
const check = process.argv.includes('--check');

const read = (p) => JSON.parse(readFileSync(`${repoRoot}${p}`, 'utf8'));

const serverVersion = read('packages/server/package.json').version;

// Map each server.json package identifier to its authoritative version.
const versionFor = {
  seekstone: serverVersion,
};

const raw = readFileSync(`${repoRoot}server.json`, 'utf8');
const manifest = JSON.parse(raw);

manifest.version = serverVersion;
for (const pkg of manifest.packages ?? []) {
  const want = versionFor[pkg.identifier];
  if (want === undefined) {
    throw new Error(
      `server.json lists unknown package identifier "${pkg.identifier}" — add it to versionFor in scripts/sync-server-json.mjs.`,
    );
  }
  pkg.version = want;
}

// Preserve the file's 2-space indent + trailing newline. biome format runs after
// this in `version-packages`, so exact formatting here is not load-bearing.
const next = `${JSON.stringify(manifest, null, 2)}\n`;

if (next === raw) {
  console.log(`server.json already in sync (version ${serverVersion}).`);
  process.exit(0);
}

if (check) {
  console.error(
    `server.json is out of sync with package versions (expected version ${serverVersion}).\n` +
      'Run `node scripts/sync-server-json.mjs` (or `npm run version-packages`) and commit the result.',
  );
  process.exit(1);
}

writeFileSync(`${repoRoot}server.json`, next);
console.log(`server.json synced to version ${serverVersion}.`);
