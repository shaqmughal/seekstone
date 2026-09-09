import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from '../log.js';
import type { SemanticConfig } from './config.js';
import { findModel, type ModelManifest } from './model-manifest.js';

/**
 * Materialize the embedding model shipped inside the semantic .mcpb variant.
 *
 * `seekstone-semantic.mcpb` carries the pinned default model as sub-cap byte
 * shards (`model/<name>.NNN.part` — Claude Desktop rejects any packed file
 * over ~108KB, SHA-169) plus a `manifest.json` naming the bundled model id.
 * Its extension manifest sets `SEEKSTONE_BUNDLED_MODEL_DIR`, and at boot this
 * reassembles the shards into the exact directory `seekstone fetch-model`
 * would have downloaded to, verifying every file against the SAME pinned
 * SHA-256 hashes (model-manifest.ts). Pure disk-to-disk I/O: the zero-network
 * guarantee (no-network.test.ts) holds bit-for-bit.
 *
 * Already-valid files are left untouched, so this is a fast hash check on
 * every boot after the first. A bundled id that doesn't match the requested
 * model (SEEKSTONE_SEMANTIC_MODEL override) is skipped — Semantic.start then
 * fails with its usual fetch-model hint.
 */

export interface MaterializeDeps {
  /** Test seam: pinned manifest lookup; defaults to model-manifest.ts. */
  manifestFor?: (id: string) => ModelManifest | undefined;
  log?: Logger;
}

export async function materializeBundledModel(
  cfg: SemanticConfig,
  bundledDir: string | undefined,
  deps: MaterializeDeps = {},
): Promise<void> {
  if (!bundledDir) return;
  if (!existsSync(bundledDir)) {
    // The env var is only ever set by the extension manifest, so a missing
    // dir means a broken install — but the model may still be on disk from a
    // prior boot; let Semantic.start decide whether anything is wrong.
    deps.log?.warn('bundled model dir missing — skipping materialization', { dir: bundledDir });
    return;
  }
  let bundledId: string;
  try {
    const raw = await readFile(join(bundledDir, 'manifest.json'), 'utf8');
    bundledId = String(JSON.parse(raw).id);
  } catch (err) {
    throw new Error(
      `bundled model: cannot read ${join(bundledDir, 'manifest.json')} — the extension bundle ` +
        `is corrupt; reinstall it (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (bundledId !== cfg.modelId) {
    deps.log?.info('bundled model does not match the requested model — skipping', {
      bundled: bundledId,
      requested: cfg.modelId,
    });
    return;
  }
  const manifest = (deps.manifestFor ?? findModel)(cfg.modelId);
  if (!manifest) return; // cfg.modelId was already validated against the pinned list at boot
  await mkdir(cfg.modelDir, { recursive: true });
  let written = 0;
  for (const file of manifest.files) {
    const dest = join(cfg.modelDir, file.name);
    if (existsSync(dest) && sha256(await readFile(dest)) === file.sha256) continue;
    const buf = await concatParts(bundledDir, file.name);
    const got = sha256(buf);
    if (got !== file.sha256) {
      throw new Error(
        `bundled model: checksum mismatch for ${file.name} (expected ${file.sha256}, got ${got}) — ` +
          'the extension bundle is corrupt; reinstall it',
      );
    }
    // Write-then-rename so a concurrently booting server never reads a torn
    // file (a torn file would also fail the hash check above and self-heal).
    const tmp = `${dest}.tmp-${process.pid}`;
    await writeFile(tmp, buf);
    await rename(tmp, dest);
    written++;
  }
  if (written > 0) {
    deps.log?.info('bundled model materialized', {
      model: manifest.id,
      dir: cfg.modelDir,
      files: written,
    });
  }
}

/** Concatenate `<name>.NNN.part` shards from the bundle dir, in order. */
async function concatParts(bundledDir: string, name: string): Promise<Buffer> {
  const prefix = `${name}.`;
  const partNum = (f: string) => Number(f.slice(prefix.length, -'.part'.length));
  const parts = (await readdir(bundledDir))
    .filter((f) => {
      if (!f.startsWith(prefix) || !f.endsWith('.part')) return false;
      const middle = f.slice(prefix.length, -'.part'.length);
      return /^\d+$/.test(middle);
    })
    .sort((a, b) => partNum(a) - partNum(b));
  if (parts.length === 0) {
    throw new Error(
      `bundled model: no shards for ${name} in ${bundledDir} — the extension bundle is ` +
        'corrupt; reinstall it',
    );
  }
  const buffers: Buffer[] = [];
  for (const part of parts) buffers.push(await readFile(join(bundledDir, part)));
  return Buffer.concat(buffers);
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
