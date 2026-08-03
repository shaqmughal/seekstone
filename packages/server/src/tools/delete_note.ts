import { access, mkdir, rename, rm } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { removeNoteBacklinks } from '../index/backlinks.js';
import { assertWritable } from '../policy.js';

export const DeleteNoteInput = z.object({
  path: z.string().describe('Vault-relative path of the note to delete.'),
  permanent: z
    .boolean()
    .default(false)
    .describe(
      'Permanently remove the note instead of moving it to the vault .trash/ folder. Defaults to false — deletes are recoverable.',
    ),
});
export type DeleteNoteInput = z.input<typeof DeleteNoteInput>;

export interface DeleteNoteResult {
  path: string;
  /** Vault-relative path the note was moved to, when not permanent. */
  trashedTo?: string;
  permanent: boolean;
}

/** Find a free destination name inside .trash/, suffixing before the extension on collision. */
async function freeTrashPath(vaultRoot: string, noteBase: string): Promise<string> {
  const ext = extname(noteBase);
  const stem = noteBase.slice(0, noteBase.length - ext.length);
  let candidate = `.trash/${noteBase}`;
  for (;;) {
    try {
      await access(join(vaultRoot, candidate));
    } catch {
      return candidate;
    }
    // Epoch-ms suffix; loop guards the (test-speed) case of two collisions in one ms.
    candidate = `.trash/${stem}.${Date.now()}${ext}`;
  }
}

export async function deleteNote(
  ctx: ServerContext,
  rawInput: DeleteNoteInput,
): Promise<DeleteNoteResult> {
  const input = DeleteNoteInput.parse(rawInput);
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }
  // Policy applies to the note being deleted; the .trash/ destination is the
  // safety mechanism itself, not a user write.
  assertWritable(ctx.policy, input.path);

  let trashedTo: string | undefined;
  if (input.permanent) {
    // rm throws ENOENT if the file doesn't exist — let it propagate.
    await rm(absPath);
  } else {
    // access first so a missing note throws ENOENT like rm does, not a
    // half-made .trash/ dir plus a rename error.
    await access(absPath);
    await mkdir(join(ctx.vaultRoot, '.trash'), { recursive: true });
    trashedTo = await freeTrashPath(ctx.vaultRoot, basename(input.path));
    // Same-volume rename: atomic, byte-identical, and invisible to the index —
    // the walker and watcher both exclude .trash/.
    await rename(absPath, join(ctx.vaultRoot, trashedTo));
  }

  // Clear the note's own outgoing refs while its entry is still readable.
  removeNoteBacklinks(ctx, input.path);
  if (ctx.notes.has(input.path)) {
    ctx.index.discard(input.path);
    ctx.notes.delete(input.path);
  }

  const result: DeleteNoteResult = { path: input.path, permanent: input.permanent };
  if (trashedTo !== undefined) result.trashedTo = trashedTo;
  return result;
}
