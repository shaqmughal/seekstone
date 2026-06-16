#!/usr/bin/env node
/**
 * Build the seekstone MCP Bundle (seekstone.mcpb).
 *
 * Steps:
 *   1. Read the current version from packages/server/package.json.
 *   2. Stamp it into packages/server/manifest.json (keeps them in sync).
 *   3. Build the fully-bundled ESM server (npx tsup, all deps inlined).
 *   4. Stage manifest + metadata + the sharded bundle into a clean dir.
 *   5. Guard: fail if any staged file exceeds the per-file cap.
 *   6. Pack the staging dir into seekstone.mcpb at the repo root.
 *
 * Why sharding: Claude Desktop's local .mcpb install preview silently rejects a
 * bundle if *any* file inside it exceeds ~108KB (SHA-169) — no dialog, no error.
 * The bundled server is ~1.7MB, so it is split into <95KB shards that the loader
 * (packages/server/mcpb-loader.mjs, shipped as dist/index.js) reassembles at
 * startup. The guard below makes a future oversized file fail the build loudly
 * instead of silently breaking one-click install.
 */

import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_FILE_BYTES, MAX_SHARD_BYTES, shard } from './shard.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, 'packages', 'server');
const manifestPath = join(serverDir, 'manifest.json');
const stage = join(root, '.mcpb-build');
const output = join(root, 'seekstone.mcpb');

// 1 + 2. Stamp version into manifest.json.
const { version } = JSON.parse(readFileSync(join(serverDir, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Stamped manifest.json with version ${version}`);

// 3. Build the fully-bundled server (all deps inlined — no node_modules at runtime).
console.log('Building server (mcpb — all deps bundled)...');
execSync('npx tsup --config tsup.mcpb.config.ts', { stdio: 'inherit', cwd: serverDir });

// 4. Stage metadata + the sharded bundle.
console.log('Staging + sharding...');
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'dist'), { recursive: true });
for (const file of ['manifest.json', 'package.json', 'README.md', 'LICENSE']) {
  cpSync(join(serverDir, file), join(stage, file));
}
const bundle = readFileSync(join(serverDir, 'dist', 'index.js'));
const shards = shard(bundle, MAX_SHARD_BYTES);
shards.forEach((part, i) => {
  writeFileSync(join(stage, 'dist', `index.${String(i).padStart(3, '0')}.part`), part);
});
// The loader becomes the entry point (dist/index.js) named in the manifest.
cpSync(join(serverDir, 'mcpb-loader.mjs'), join(stage, 'dist', 'index.js'));
console.log(
  `Split ${bundle.length} bytes into ${shards.length} shards (max ${MAX_SHARD_BYTES} bytes each)`,
);

// 5. Guard: nothing in the bundle may exceed the per-file cap, or Claude Desktop
//    silently rejects it (SHA-169).
for (const file of walk(stage)) {
  const { size } = statSync(file);
  if (size > MAX_FILE_BYTES) {
    throw new Error(
      `mcpb: ${relative(root, file)} is ${size} bytes (> ${MAX_FILE_BYTES} cap). ` +
        'Claude Desktop will silently reject the bundle — see SHA-169.',
    );
  }
}

// 6. Pack.
console.log('Packing...');
execSync(`npx @anthropic-ai/mcpb pack "${stage}" "${output}"`, { stdio: 'inherit', cwd: root });
rmSync(stage, { recursive: true, force: true });

console.log(
  `\nBuilt: seekstone.mcpb (v${version}) — sharded, every file < ${MAX_FILE_BYTES} bytes`,
);

/** Recursively yield every file path under `dir`. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
