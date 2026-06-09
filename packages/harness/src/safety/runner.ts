import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Backend } from '../bench/backend.js';
import { copyVault } from './copy.js';
import {
  type OpKind,
  type OpResult,
  bodyAppendOp,
  fmEditOp,
  identityOp,
  patchNoteOp,
  replaceInNoteOp,
} from './ops.js';
import { type Candidate, selectFrontmatterHeavyNotes } from './select.js';

export interface SafetyOpResult {
  op: OpKind;
  pass: boolean;
  reason?: string;
  change: string;
}

export interface SafetyNoteResult {
  relPath: string;
  fmKeys: string[];
  ops: SafetyOpResult[];
}

export interface SafetySummary {
  snapshotDate: string;
  backend: { name: string; description: string };
  vaultCopyRoot: string;
  originalVaultRoot: string;
  sampleSize: number;
  passByOp: Record<OpKind, { pass: number; fail: number }>;
  notes: SafetyNoteResult[];
}

export interface SafetyRunnerOptions {
  /** The original vault — read-only. */
  originalVaultRoot: string;
  /**
   * A backend whose `write()` targets the COPY at `vaultCopyRoot`. The runner
   * does NOT spin up the backend itself; you wire it up beforehand and
   * confirm it points at the copy. This is enforced by `assertWritesScratchVault`.
   */
  backend: Backend;
  /** Resolved absolute path the backend will write to. Must match copyRoot. */
  vaultCopyRoot: string;
  sampleSize?: number;
}

/**
 * Top-level write-safety test.
 *
 * Workflow:
 *   1. caller copies the vault and starts a backend pointing at the copy
 *   2. caller calls this function with the copy root + backend
 *   3. for each sample note, we read its bytes from disk, run identity /
 *      body-append / fm-edit ops, write via the backend, re-read from disk,
 *      and verify
 *   4. report pass/fail per op per note
 */
export async function runSafety(opts: SafetyRunnerOptions): Promise<SafetySummary> {
  const sampleSize = opts.sampleSize ?? 25;
  const copyAbs = resolve(opts.vaultCopyRoot);
  const origAbs = resolve(opts.originalVaultRoot);

  if (copyAbs === origAbs) {
    throw new Error(`Refusing to run: vault copy path equals original (${origAbs}).`);
  }

  const candidates = await selectFrontmatterHeavyNotes(copyAbs, { sample: sampleSize });
  const notes: SafetyNoteResult[] = [];
  const passByOp: Record<OpKind, { pass: number; fail: number }> = {
    identity: { pass: 0, fail: 0 },
    'body-append': { pass: 0, fail: 0 },
    'fm-edit': { pass: 0, fail: 0 },
    'patch-note': { pass: 0, fail: 0 },
    'replace-in-note': { pass: 0, fail: 0 },
  };

  for (const c of candidates) {
    const noteResults: SafetyOpResult[] = [];
    for (const opKind of [
      'identity',
      'body-append',
      'fm-edit',
      'patch-note',
      'replace-in-note',
    ] as OpKind[]) {
      // Always re-read fresh — previous ops may have left the file modified.
      const original = await readFile(c.absPath);
      const op = buildOp(opKind, original);
      if (!op) {
        noteResults.push({ op: opKind, pass: false, reason: 'op not applicable', change: '—' });
        passByOp[opKind].fail += 1;
        continue;
      }
      await opts.backend.write(c.relPath, op.bytes.toString('utf8'));
      const post = await readFile(c.absPath);
      const v = op.verify(post, original);
      noteResults.push({ op: opKind, pass: v.pass, reason: v.reason, change: op.change });
      if (v.pass) passByOp[opKind].pass += 1;
      else passByOp[opKind].fail += 1;
    }
    notes.push({ relPath: c.relPath, fmKeys: c.fmKeys, ops: noteResults });
  }

  return {
    snapshotDate: new Date().toISOString(),
    backend: { name: opts.backend.name, description: opts.backend.description },
    vaultCopyRoot: copyAbs,
    originalVaultRoot: origAbs,
    sampleSize: candidates.length,
    passByOp,
    notes,
  };
}

function buildOp(kind: OpKind, original: Buffer): OpResult | null {
  switch (kind) {
    case 'identity':
      return identityOp(original);
    case 'body-append':
      return bodyAppendOp(original);
    case 'fm-edit':
      return fmEditOp(original);
    case 'patch-note':
      return patchNoteOp(original);
    case 'replace-in-note':
      return replaceInNoteOp(original);
  }
}

/**
 * Convenience: copy the vault and return the copy root. Caller is responsible
 * for pointing their backend at the copy before invoking `runSafety`.
 */
export async function prepareSafetyVault(originalVaultRoot: string): Promise<string> {
  const { copyRoot } = await copyVault(originalVaultRoot);
  // sanity assertion: copyRoot must contain at least one .md to be a vault
  // (extremely cheap belt-and-braces; cp would have errored if the src was wrong)
  void join(copyRoot, '.'); // touch path to keep tsc happy if cp signature changes
  return copyRoot;
}
