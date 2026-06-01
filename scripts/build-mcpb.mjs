#!/usr/bin/env node
/**
 * Build the seekstone MCP Bundle (seekstone.mcpb).
 *
 * Steps:
 *   1. Read the current version from packages/server/package.json.
 *   2. Stamp it into packages/server/manifest.json (keeps them in sync).
 *   3. Build the server (npx tsup in packages/server).
 *   4. Pack packages/server/ into seekstone.mcpb at the repo root.
 */

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, 'packages', 'server');
const manifestPath = join(serverDir, 'manifest.json');
const output = join(root, 'seekstone.mcpb');

// 1. Read version from package.json.
const pkg = JSON.parse(await readFile(join(serverDir, 'package.json'), 'utf8'));
const { version } = pkg;

// 2. Stamp version into manifest.json.
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.version = version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Stamped manifest.json with version ${version}`);

// 3. Build the server.
console.log('Building server...');
execSync('npm run build -w seekstone', { stdio: 'inherit', cwd: root });

// 4. Pack into seekstone.mcpb.
console.log('Packing...');
execSync(`npx @anthropic-ai/mcpb pack "${serverDir}" "${output}"`, {
  stdio: 'inherit',
  cwd: root,
});

console.log(`\nBuilt: seekstone.mcpb (v${version})`);
