import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Backend } from '../bench/backend.js';

/**
 * Behavioral safety ops — unlike the byte-transform ops in ops.ts (which
 * only need `backend.write`), these drive a server's delete/create/CAS
 * SEMANTICS through the optional Backend methods and judge the observed
 * behavior on disk. Each restores the note afterwards so subsequent ops and
 * notes are unaffected.
 */

export interface BehavioralOpOutcome {
  status: 'pass' | 'fail';
  reason?: string;
  change: string;
}

/** Directories a trash-style delete plausibly lands in, checked before any full scan. */
const TRASH_DIRS = ['.trash', '.Trash', 'trash', '_trash'];

async function findRecoverableCopy(
  vaultCopyRoot: string,
  original: Buffer,
): Promise<string | undefined> {
  for (const dir of TRASH_DIRS) {
    // Recursive: servers like obsidian-mcp-rs preserve the note's folder
    // structure inside the trash dir (.trash/Sub Folder/Note.md).
    let entries: string[];
    try {
      entries = (await readdir(join(vaultCopyRoot, dir), { recursive: true })) as string[];
    } catch {
      continue;
    }
    for (const rel of entries) {
      try {
        const bytes = await readFile(join(vaultCopyRoot, dir, rel));
        if (bytes.equals(original)) return `${dir}/${rel.replaceAll('\\', '/')}`;
      } catch {
        /* directory entry or unreadable — skip */
      }
    }
  }
  return undefined;
}

/**
 * recoverable-delete: delete via the server's tool, then require (a) the
 * original path is gone and (b) a byte-identical copy survives somewhere
 * recoverable. Layout-agnostic across common trash dir names so competitors
 * with different schemes can pass. Restores the note afterwards.
 */
export async function recoverableDeleteOp(
  backend: Backend,
  relPath: string,
  absPath: string,
  vaultCopyRoot: string,
): Promise<BehavioralOpOutcome> {
  const change = 'delete via server tool; expect a recoverable copy';
  if (!backend.deleteNote) throw new Error('caller must check backend.deleteNote');
  const original = await readFile(absPath);
  try {
    await backend.deleteNote(relPath);
  } catch (err) {
    return { status: 'fail', reason: `delete call errored: ${(err as Error).message}`, change };
  }
  let stillThere = true;
  try {
    await access(absPath);
  } catch {
    stillThere = false;
  }
  const recoveredAt = await findRecoverableCopy(vaultCopyRoot, original);
  // Restore before judging so a failure doesn't cascade into later ops.
  await writeFile(absPath, original);
  if (stillThere) return { status: 'fail', reason: 'note still exists after delete', change };
  if (recoveredAt === undefined) {
    return {
      status: 'fail',
      reason: 'no byte-identical recoverable copy found (permanent delete)',
      change,
    };
  }
  return { status: 'pass', reason: `recoverable at ${recoveredAt}`, change };
}

/**
 * create-no-clobber: attempt a create-shaped call against an EXISTING note.
 * Pass = the call errored AND the disk bytes are unchanged. A server whose
 * "create" silently overwrites fails here — that is the finding.
 */
export async function createNoClobberOp(
  backend: Backend,
  relPath: string,
  absPath: string,
): Promise<BehavioralOpOutcome> {
  const change = 'create over an existing note; expect refusal';
  if (!backend.createNote) throw new Error('caller must check backend.createNote');
  const original = await readFile(absPath);
  let errored = false;
  try {
    await backend.createNote(relPath, '<!-- seekstone-harness clobber attempt -->\n');
  } catch {
    errored = true;
  }
  const post = await readFile(absPath).catch(() => Buffer.alloc(0));
  const unchanged = post.equals(original);
  if (!unchanged) await writeFile(absPath, original);
  if (!errored) {
    return {
      status: 'fail',
      reason: unchanged
        ? 'create over existing note reported success (even though bytes survived)'
        : 'create over existing note clobbered its content without error',
      change,
    };
  }
  if (!unchanged) {
    return { status: 'fail', reason: 'create errored but still modified the note', change };
  }
  return { status: 'pass', change };
}

/**
 * cas-conflict: read a version token, tamper with the file out-of-band, then
 * attempt guarded destructive calls with the stale token. Pass = every
 * attempted call was refused AND the out-of-band edit survived (the
 * concurrent editor's work is safe). The write guard is mandatory for the op
 * to run; move and delete guards are exercised when the backend declares
 * casMove/casDelete, and the outcome reason records which guards were
 * covered so partial support is visible in the report.
 */
export async function casConflictOp(
  backend: Backend,
  relPath: string,
  absPath: string,
): Promise<BehavioralOpOutcome> {
  const change = 'stale-hash guarded write/move/delete after out-of-band edit; expect conflict';
  if (!backend.readWithHash || !backend.casWrite) {
    throw new Error('caller must check backend.readWithHash/casWrite');
  }
  const original = await readFile(absPath);
  const { hash } = await backend.readWithHash(relPath);
  const tampered = Buffer.concat([original, Buffer.from('\n<!-- concurrent edit -->\n', 'utf8')]);
  await writeFile(absPath, tampered);

  const covered: string[] = [];
  const attempt = async (guard: string, call: () => Promise<void>): Promise<string | undefined> => {
    let errored = false;
    try {
      await call();
    } catch {
      errored = true;
    }
    if (!errored) return `stale-hash ${guard} reported success`;
    const post = await readFile(absPath).catch(() => Buffer.alloc(0));
    if (!post.equals(tampered)) {
      return `${guard} errored but the concurrent edit was lost`;
    }
    covered.push(guard);
    return undefined;
  };

  let failReason = await attempt('write', () =>
    (backend.casWrite as NonNullable<Backend['casWrite']>)(
      relPath,
      'CLOBBER ATTEMPT — must never land\n',
      hash,
    ),
  );
  if (failReason === undefined && backend.casMove) {
    // Destination inside the scratch copy; a correctly refused move never
    // creates it. If a buggy backend DID move the file, the attempt() disk
    // check above reports the loss, and the restore below re-creates the
    // original at the source path.
    failReason = await attempt('move', () =>
      (backend.casMove as NonNullable<Backend['casMove']>)(
        relPath,
        `${relPath}.cas-conflict-moved.md`,
        hash,
      ),
    );
  }
  if (failReason === undefined && backend.casDelete) {
    failReason = await attempt('delete', () =>
      (backend.casDelete as NonNullable<Backend['casDelete']>)(relPath, hash),
    );
  }

  await writeFile(absPath, original);
  if (failReason !== undefined) return { status: 'fail', reason: failReason, change };
  return { status: 'pass', reason: `guards refused: ${covered.join(', ')}`, change };
}
