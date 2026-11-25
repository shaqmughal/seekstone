import { writeSync } from 'node:fs';

/**
 * `writeSync` may write fewer bytes than asked; loop until all of `data` is
 * out. Throws if a call writes nothing, so a stuck write fails instead of
 * spinning. Used by the journal and the audit log.
 */
export function writeAll(fd: number, data: string): void {
  const buf = Buffer.from(data, 'utf8');
  for (let off = 0; off < buf.length; ) {
    const n = writeSync(fd, buf, off, buf.length - off);
    if (n <= 0) throw new Error('write made no progress');
    off += n;
  }
}
