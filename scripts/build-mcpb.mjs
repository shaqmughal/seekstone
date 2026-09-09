#!/usr/bin/env node

/**
 * Build the seekstone MCP Bundles.
 *
 *   seekstone.mcpb          — the standard bundle (search, writes, links).
 *   seekstone-semantic.mcpb — same server + the pinned default embedding model
 *                             shipped inside, with semantic search hardwired on
 *                             (SHA-309). Choosing this download IS the opt-in.
 *
 * Steps:
 *   1. Read the current version from packages/server/package.json.
 *   2. Stamp it into packages/server/manifest.json (keeps them in sync).
 *   3. Build the fully-bundled ESM server (npx tsup, all deps inlined).
 *   4. Stage manifest + metadata + the sharded bundle into a clean dir.
 *   5. Semantic variant only: stage the model as shards + manifest overrides.
 *   6. Guard: fail if any staged file exceeds the per-file cap.
 *   7. Pack each staging dir into its .mcpb at the repo root.
 *
 * Why sharding: Claude Desktop's local .mcpb install preview silently rejects a
 * bundle if *any* file inside it exceeds ~108KB (SHA-169) — no dialog, no error.
 * The bundled server is ~1.7MB, so it is split into <95KB shards that the loader
 * (packages/server/mcpb-loader.mjs, shipped as dist/index.js) reassembles at
 * startup. The ~30MB model gets the same treatment (model/<name>.NNN.part),
 * reassembled at boot by the server itself against the pinned sha256 hashes
 * (packages/server/src/semantic/bundled-model.ts) — disk-only, so the
 * zero-network guarantee is untouched. The guard below makes a future
 * oversized file fail the build loudly instead of silently breaking install.
 *
 * The model files come from the same place `seekstone fetch-model` puts them
 * (honoring SEEKSTONE_MODEL_PATH / SEEKSTONE_CACHE_DIR); the build runs
 * fetch-model itself when they are missing, and always re-verifies the pinned
 * hashes before staging — build-time network, never runtime.
 */

import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_FILE_BYTES, MAX_SHARD_BYTES, shard } from './shard.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverDir = join(root, 'packages', 'server');
const manifestPath = join(serverDir, 'manifest.json');

// 1 + 2. Stamp version into manifest.json — a surgical string replace, not a
// re-serialize, so the committed file keeps its biome formatting (`biome
// check .` in CI fails on a JSON.stringify-shaped rewrite).
const { version } = JSON.parse(readFileSync(join(serverDir, 'package.json'), 'utf8'));
const rawManifest = readFileSync(manifestPath, 'utf8').replace(
  /"version":\s*"[^"]*"/,
  `"version": "${version}"`,
);
writeFileSync(manifestPath, rawManifest);
const manifest = JSON.parse(rawManifest);
if (manifest.version !== version) {
  throw new Error(`mcpb: failed to stamp version ${version} into manifest.json`);
}
console.log(`Stamped manifest.json with version ${version}`);

// 3. Build the fully-bundled server (all deps inlined — no node_modules at runtime).
console.log('Building server (mcpb — all deps bundled)...');
execSync('npx tsup --config tsup.mcpb.config.ts', { stdio: 'inherit', cwd: serverDir });

// Guard: the build must emit exactly one file. Only dist/index.js is sharded
// and staged, so a chunk-*.js (from tsup's ESM code splitting, triggered by any
// dynamic import()) would be silently dropped and the installed extension would
// die at startup with ERR_MODULE_NOT_FOUND.
const emitted = readdirSync(join(serverDir, 'dist')).filter((f) => f !== 'index.js');
if (emitted.length > 0) {
  throw new Error(
    `mcpb: build emitted extra files next to dist/index.js (${emitted.join(', ')}). ` +
      'The bundle must be a single file — check `splitting: false` in tsup.mcpb.config.ts.',
  );
}
const bundle = readFileSync(join(serverDir, 'dist', 'index.js'));

// The pinned default-model manifest (id + per-file sha256), straight from the
// TS single source of truth so the staged hashes can never drift from what
// bundled-model.ts will verify at boot.
const model = JSON.parse(
  execFileSync(
    'npx',
    [
      'tsx',
      '--eval',
      "import('./src/semantic/model-manifest.ts').then(m => console.log(JSON.stringify(m.DEFAULT_MODEL)))",
    ],
    { cwd: serverDir, encoding: 'utf8' },
  ).trim(),
);

buildVariant('seekstone.mcpb', manifest, null);
buildVariant('seekstone-semantic.mcpb', semanticManifest(manifest), model);

/** Stage and pack one bundle variant. `modelManifest` null → standard bundle. */
function buildVariant(outputName, variantManifest, modelManifest) {
  const stage = join(root, '.mcpb-build');
  const output = join(root, outputName);
  console.log(`\nStaging + sharding ${outputName}...`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'dist'), { recursive: true });
  writeFileSync(join(stage, 'manifest.json'), `${JSON.stringify(variantManifest, null, 2)}\n`);
  for (const file of ['package.json', 'README.md', 'LICENSE']) {
    cpSync(join(serverDir, file), join(stage, file));
  }
  const shards = shard(bundle, MAX_SHARD_BYTES);
  shards.forEach((part, i) => {
    writeFileSync(join(stage, 'dist', `index.${String(i).padStart(3, '0')}.part`), part);
  });
  // The loader becomes the entry point (dist/index.js) named in the manifest.
  cpSync(join(serverDir, 'mcpb-loader.mjs'), join(stage, 'dist', 'index.js'));
  console.log(
    `Split ${bundle.length} bytes into ${shards.length} shards (max ${MAX_SHARD_BYTES} bytes each)`,
  );

  if (modelManifest) stageModel(stage, modelManifest);

  // Guard: nothing in the bundle may exceed the per-file cap, or Claude Desktop
  // silently rejects it (SHA-169).
  for (const file of walk(stage)) {
    const { size } = statSync(file);
    if (size > MAX_FILE_BYTES) {
      throw new Error(
        `mcpb: ${relative(root, file)} is ${size} bytes (> ${MAX_FILE_BYTES} cap). ` +
          'Claude Desktop will silently reject the bundle — see SHA-169.',
      );
    }
  }

  console.log('Packing...');
  execSync(`npx @anthropic-ai/mcpb pack "${stage}" "${output}"`, { stdio: 'inherit', cwd: root });
  rmSync(stage, { recursive: true, force: true });
  console.log(`Built: ${outputName} (v${version}) — sharded, every file < ${MAX_FILE_BYTES} bytes`);
}

/** The semantic variant's manifest: separate identity, feature hardwired on. */
function semanticManifest(base) {
  const m = structuredClone(base);
  m.name = 'seekstone-semantic';
  m.display_name = 'Seekstone (Semantic Search)';
  m.description =
    'Obsidian MCP server — filesystem-direct vault access, low context-tax. ' +
    'This variant ships the local embedding model inside the bundle: semantic ' +
    'search works out of the box, no terminal, no downloads at runtime.';
  m.server.mcp_config.env = {
    ...m.server.mcp_config.env,
    SEEKSTONE_SEMANTIC: '1',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: ${__dirname} is an mcpb manifest placeholder Claude Desktop substitutes at install, not a JS template.
    SEEKSTONE_BUNDLED_MODEL_DIR: '${__dirname}/model',
  };
  return m;
}

/**
 * Stage the pinned default model into `<stage>/model/` as sub-cap shards plus
 * a manifest.json naming the model id (bundled-model.ts checks it at boot).
 * Fetches via the server's own fetch-model CLI when files are missing, and
 * always re-verifies the pinned sha256 before staging.
 */
function stageModel(stage, modelManifest) {
  const cacheDir = process.env.SEEKSTONE_CACHE_DIR || join(homedir(), '.cache', 'seekstone');
  const sourceDir = process.env.SEEKSTONE_MODEL_PATH || join(cacheDir, 'models', modelManifest.id);
  const missing = modelManifest.files.some((f) => !existsSync(join(sourceDir, f.name)));
  if (missing) {
    console.log(`Model ${modelManifest.id} not found in ${sourceDir} — running fetch-model...`);
    execFileSync('npx', ['tsx', 'src/index.ts', 'fetch-model'], {
      cwd: serverDir,
      stdio: 'inherit',
    });
  }
  const modelStage = join(stage, 'model');
  mkdirSync(modelStage, { recursive: true });
  writeFileSync(
    join(modelStage, 'manifest.json'),
    `${JSON.stringify({ id: modelManifest.id, license: modelManifest.license }, null, 2)}\n`,
  );
  let total = 0;
  for (const file of modelManifest.files) {
    const buf = readFileSync(join(sourceDir, file.name));
    // Integrity check of a public pinned hash, not a secret comparison —
    // `got`, not `hash`, or Codacy's timing-attack rule pattern-matches the
    // identifier name (same workaround as semantic/state.ts).
    const got = createHash('sha256').update(buf).digest('hex');
    if (got !== file.sha256) {
      throw new Error(
        `mcpb: ${file.name} in ${sourceDir} has sha256 ${got}, expected ${file.sha256}. ` +
          'Refusing to stage an unverified model — delete the file and re-run.',
      );
    }
    const parts = shard(buf, MAX_SHARD_BYTES);
    parts.forEach((part, i) => {
      writeFileSync(join(modelStage, `${file.name}.${String(i).padStart(3, '0')}.part`), part);
    });
    total += parts.length;
  }
  console.log(`Staged model ${modelManifest.id}: ${total} shards, hashes verified`);
}

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
