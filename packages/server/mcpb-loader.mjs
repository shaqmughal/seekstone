#!/usr/bin/env node
/**
 * Entry point for the .mcpb bundle (shipped as `dist/index.js`).
 *
 * The real server is a single large ESM bundle. Claude Desktop's local install
 * preview silently rejects a bundle if any file inside it exceeds ~108KB
 * (SHA-169), so the bundle is split into sub-cap shards (`index.NNN.part`).
 * This loader concatenates the shards back into one module and imports it.
 *
 * Reassembly goes through a temp file (not a `data:` URL) because the bundle's
 * banner calls `createRequire(import.meta.url)`, which needs a real file URL to
 * resolve Node built-ins. The temp file is keyed by a content hash and reused
 * across launches, so it is written at most once per bundle version.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const parts = readdirSync(dir)
  .filter((f) => /^index\.\d+\.part$/.test(f))
  .sort();

if (parts.length === 0) {
  throw new Error(`seekstone: no bundle shards (index.NNN.part) found in ${dir}`);
}

const code = Buffer.concat(parts.map((p) => readFileSync(join(dir, p))));
const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
const out = join(tmpdir(), `seekstone-bundle-${hash}.mjs`);

if (!existsSync(out) || statSync(out).size !== code.length) {
  writeFileSync(out, code);
}

await import(pathToFileURL(out).href);
