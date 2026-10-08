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

/**
 * task-toggle (SHA-285): prove the single-character checkbox rewrite and its
 * expectText guard. Sampled notes are frontmatter-heavy and carry no
 * checkboxes, so the op seeds its own: append a known task line out-of-band,
 * toggle it through the server's update_task, and require the post-file to
 * differ from the seeded bytes at EXACTLY the marker byte. Then call again
 * with a wrong expectText and require a refusal that leaves the file
 * untouched. Restores the original afterwards.
 */
export async function taskToggleOp(
  backend: Backend,
  relPath: string,
  absPath: string,
): Promise<BehavioralOpOutcome> {
  const change = 'seed a checkbox; toggle via server tool (1-byte diff); wrong expectText refused';
  if (!backend.updateTask) throw new Error('caller must check backend.updateTask');
  const updateTask = backend.updateTask.bind(backend);
  const original = await readFile(absPath);

  const TASK_TEXT = 'seekstone-harness task target';
  const originalStr = original.toString('utf8');
  const seeded = `${originalStr}${originalStr.endsWith('\n') ? '' : '\n'}- [ ] ${TASK_TEXT}\n`;
  await writeFile(absPath, seeded);
  const taskLine = seeded.split('\n').length - 1; // last content line (file ends with \n)
  const markerOffset = seeded.lastIndexOf(`- [ ] ${TASK_TEXT}`) + 3;
  const expected = `${seeded.slice(0, markerOffset)}x${seeded.slice(markerOffset + 1)}`;

  const finish = async (outcome: BehavioralOpOutcome): Promise<BehavioralOpOutcome> => {
    await writeFile(absPath, original);
    return outcome;
  };

  try {
    await updateTask(relPath, taskLine, 'x', TASK_TEXT);
  } catch (err) {
    return finish({
      status: 'fail',
      reason: `toggle call errored: ${(err as Error).message}`,
      change,
    });
  }
  const post = await readFile(absPath, 'utf8').catch(() => '');
  if (post !== expected) {
    return finish({
      status: 'fail',
      reason:
        post === seeded
          ? 'toggle reported success but the marker did not change'
          : 'toggle changed more than the single marker byte',
      change,
    });
  }

  let refused = false;
  try {
    await updateTask(relPath, taskLine, ' ', 'WRONG TEXT — must be refused');
  } catch {
    refused = true;
  }
  const post2 = await readFile(absPath, 'utf8').catch(() => '');
  if (!refused) {
    return finish({ status: 'fail', reason: 'wrong expectText was not refused', change });
  }
  if (post2 !== expected) {
    return finish({
      status: 'fail',
      reason: 'expectText refusal still modified the file',
      change,
    });
  }
  return finish({ status: 'pass', reason: 'single-byte toggle + guarded refusal', change });
}

/**
 * undo-roundtrip: prove "every write is reversible". Two journaled writes
 * through the server's own tools — a guarded whole-file replace (casWrite)
 * and a delete (deleteNote, when declared) — each followed by
 * undoLastWrite. Pass = after every undo the note is byte-identical to the
 * original. The op restores the original afterwards regardless, so a failing
 * undo never cascades into later ops.
 */
export async function undoRoundtripOp(
  backend: Backend,
  relPath: string,
  absPath: string,
): Promise<BehavioralOpOutcome> {
  const change = 'replace then delete via server tools; undo each; expect original bytes';
  if (!backend.undoLastWrite || !backend.readWithHash || !backend.casWrite) {
    throw new Error('caller must check backend.undoLastWrite/readWithHash/casWrite');
  }
  const undo = backend.undoLastWrite.bind(backend);
  const original = await readFile(absPath);
  const covered: string[] = [];

  const roundtrip = async (
    kind: string,
    mutate: () => Promise<void>,
  ): Promise<string | undefined> => {
    try {
      await mutate();
    } catch (err) {
      return `${kind} call errored: ${(err as Error).message}`;
    }
    const mid = await readFile(absPath).catch(() => Buffer.alloc(0));
    if (mid.equals(original)) return `${kind} did not change the note, nothing to undo`;
    try {
      await undo();
    } catch (err) {
      return `undo after ${kind} errored: ${(err as Error).message}`;
    }
    const post = await readFile(absPath).catch(() => Buffer.alloc(0));
    if (!post.equals(original)) return `undo after ${kind} did not restore the original bytes`;
    covered.push(kind);
    return undefined;
  };

  let failReason = await roundtrip('write', async () => {
    const { hash } = await (backend.readWithHash as NonNullable<Backend['readWithHash']>)(relPath);
    await (backend.casWrite as NonNullable<Backend['casWrite']>)(
      relPath,
      '<!-- seekstone-harness undo target -->\n',
      hash,
    );
  });
  if (failReason === undefined && backend.deleteNote) {
    failReason = await roundtrip('delete', () =>
      (backend.deleteNote as NonNullable<Backend['deleteNote']>)(relPath),
    );
  }

  await writeFile(absPath, original);
  if (failReason !== undefined) return { status: 'fail', reason: failReason, change };
  return { status: 'pass', reason: `undone: ${covered.join(', ')}`, change };
}
