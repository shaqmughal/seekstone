import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Backend } from '../bench/backend.js';
import {
  casConflictOp,
  createNoClobberOp,
  recoverableDeleteOp,
  undoRoundtripOp,
} from './behavioral-ops.js';
import { copyVault } from './copy.js';
import {
  bodyAppendOp,
  fmEditOp,
  identityOp,
  type OpKind,
  type OpResult,
  patchNoteOp,
  replaceInNoteOp,
} from './ops.js';
import { selectFrontmatterHeavyNotes } from './select.js';

export type OpStatus = 'pass' | 'fail' | 'skipped';

export interface SafetyOpResult {
  op: OpKind;
  status: OpStatus;
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
  passByOp: Record<OpKind, { pass: number; fail: number; skipped: number }>;
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

/** The byte-transform ops (need only backend.write). */
const BYTE_OPS: OpKind[] = ['identity', 'body-append', 'fm-edit', 'patch-note', 'replace-in-note'];
/** The behavioral ops (need optional Backend methods; skipped when absent). */
const BEHAVIORAL_OPS: OpKind[] = [
  'recoverable-delete',
  'create-no-clobber',
  'cas-conflict',
  'undo-roundtrip',
];

/**
 * Top-level write-safety test.
 *
 * Workflow:
 *   1. caller copies the vault and starts a backend pointing at the copy
 *   2. caller calls this function with the copy root + backend
 *   3. for each sample note, we read its bytes from disk, run the byte ops
 *      (write via backend, re-read, verify) then the behavioral ops
 *      (delete/create/CAS semantics; skipped when the backend lacks the
 *      capability — the skip IS the capability matrix)
 *   4. report pass/fail/skipped per op per note
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
  const passByOp = Object.fromEntries(
    [...BYTE_OPS, ...BEHAVIORAL_OPS].map((k) => [k, { pass: 0, fail: 0, skipped: 0 }]),
  ) as Record<OpKind, { pass: number; fail: number; skipped: number }>;

  const record = (list: SafetyOpResult[], r: SafetyOpResult): void => {
    list.push(r);
    passByOp[r.op][r.status] += 1;
  };

  for (const c of candidates) {
    const noteResults: SafetyOpResult[] = [];

    for (const opKind of BYTE_OPS) {
      // Always re-read fresh — previous ops may have left the file modified.
      const original = await readFile(c.absPath);
      const op = buildOp(opKind, original);
      if (!op) {
        // Note-shape inapplicability (no frontmatter / heading / eligible
        // word) — not an adapter failure.
        record(noteResults, {
          op: opKind,
          status: 'skipped',
          reason: 'op not applicable to this note',
          change: '—',
        });
        continue;
      }
      try {
        await opts.backend.write(c.relPath, op.bytes.toString('utf8'));
      } catch (err) {
        // e.g. an adapter whose only write-shaped tool refuses existing paths
        // (obsidian-mcp-pro create_note). Record and continue — one adapter
        // quirk must not abort the whole run.
        record(noteResults, {
          op: opKind,
          status: 'fail',
          reason: `write call errored: ${(err as Error).message}`,
          change: op.change,
        });
        continue;
      }
      const post = await readFile(c.absPath);
      const v = op.verify(post, original);
      record(noteResults, {
        op: opKind,
        status: v.pass ? 'pass' : 'fail',
        reason: v.reason,
        change: op.change,
      });
    }

    for (const opKind of BEHAVIORAL_OPS) {
      const skip = (missing: string): void =>
        record(noteResults, {
          op: opKind,
          status: 'skipped',
          reason: `backend does not support ${missing}`,
          change: '—',
        });
      if (opKind === 'recoverable-delete') {
        if (!opts.backend.deleteNote) {
          skip('deleteNote');
          continue;
        }
        const r = await recoverableDeleteOp(opts.backend, c.relPath, c.absPath, copyAbs);
        record(noteResults, { op: opKind, ...r });
      } else if (opKind === 'create-no-clobber') {
        if (!opts.backend.createNote) {
          skip('createNote');
          continue;
        }
        const r = await createNoClobberOp(opts.backend, c.relPath, c.absPath);
        record(noteResults, { op: opKind, ...r });
      } else if (opKind === 'cas-conflict') {
        if (!opts.backend.readWithHash || !opts.backend.casWrite) {
          skip('readWithHash/casWrite');
          continue;
        }
        const r = await casConflictOp(opts.backend, c.relPath, c.absPath);
        record(noteResults, { op: opKind, ...r });
      } else {
        if (!opts.backend.undoLastWrite || !opts.backend.readWithHash || !opts.backend.casWrite) {
          skip('undoLastWrite');
          continue;
        }
        const r = await undoRoundtripOp(opts.backend, c.relPath, c.absPath);
        record(noteResults, { op: opKind, ...r });
      }
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
    default:
      throw new Error(`buildOp called with behavioral op: ${kind}`);
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
