import { createHash } from 'node:crypto';

/**
 * Content hashing for optional compare-and-swap edits.
 *
 * The hash is sha-256 (hex) of the exact raw string a tool read from disk —
 * disk bytes are the version identity. `read_note` and every mutating tool
 * return `contentHash`; edit tools accept `prevHash` and refuse to write when
 * the note changed since it was read. This is conflict DETECTION, not
 * locking: the window between check and rename is the same one the OS gives
 * any two writers. node:crypto is fully offline — the zero-network guarantee
 * is unaffected.
 */
export function contentHash(raw: string | Buffer): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Throw the structured hash_conflict error when `prevHash` no longer matches
 * the freshly-read content. Call immediately after the disk read, before any
 * edit is computed.
 */
export function assertHashMatch(raw: string, prevHash: string, path: string): void {
  const actual = contentHash(raw);
  if (actual !== prevHash) {
    throw new Error(
      JSON.stringify({
        error: 'hash_conflict',
        path,
        expected: prevHash,
        actual,
        hint: 'Note changed on disk since it was read. Re-read it and retry with the new contentHash.',
      }),
    );
  }
}
