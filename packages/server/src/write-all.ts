import { writeSync } from 'node:fs';

/**
 * Loop `writeSync`, which may write fewer bytes than asked, until `data` is out.
 * Throws if a call writes nothing. `progress.written` counts the bytes out.
 * With `position`, writes there instead of at the fd's current offset.
 */
export function writeAll(
  fd: number,
  data: string | Buffer,
  progress = { written: 0 },
  position?: number,
): void {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  for (let off = 0; off < buf.length; ) {
    const n =
      position === undefined
        ? writeSync(fd, buf, off, buf.length - off)
        : writeSync(fd, buf, off, buf.length - off, position + off);
    if (n <= 0) throw new Error('write made no progress');
    off += n;
    progress.written = off;
  }
}
