import { writeSync } from 'node:fs';

/**
 * Loop `writeSync`, which may write fewer bytes than asked, until `data` is out.
 * Throws if a call writes nothing. `progress.written` counts the bytes out.
 */
export function writeAll(fd: number, data: string, progress = { written: 0 }): void {
  const buf = Buffer.from(data, 'utf8');
  for (let off = 0; off < buf.length; ) {
    const n = writeSync(fd, buf, off, buf.length - off);
    if (n <= 0) throw new Error('write made no progress');
    off += n;
    progress.written = off;
  }
}
