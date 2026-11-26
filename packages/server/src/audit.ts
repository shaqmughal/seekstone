import {
  appendFileSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readSync,
  renameSync,
  statSync,
} from 'node:fs';
import { parseSize } from './log.js';
import { isSymlinkRefusal } from './symlinks.js';
import { writeAll } from './write-all.js';

/**
 * Structured audit log — an append-only JSONL trail of every write-tool
 * invocation, successful or refused. Opt-in via SEEKSTONE_AUDIT_FILE.
 *
 * One record per write call:
 *
 *   { v: 1, ts, tool, outcome, durationMs, seq?, files: [{ path, hashBefore,
 *     hashAfter }], ...opDetail, error? }
 *
 * `outcome` is `ok`, `hash_conflict`, `undo_conflict`, `policy_denied`, or
 * `error`. Hashes are the same sha-256 values `read_note` returns as
 * `contentHash`, so a user can verify a record against their vault. When the
 * write journal is on, `files` and `seq` come from the journal entry the call
 * committed (so the audit row indexes straight into `undo_write`); otherwise
 * only the after-hash from the tool result is known.
 *
 * Privacy: records carry paths, hashes, byte counts, and op metadata — never
 * note content, frontmatter values, or search queries. Safe to attach to a
 * bug report.
 *
 * Durability: each record is appended and fsync'd AFTER the vault write
 * commits (a crash loses at most the in-flight record; earlier records are
 * never touched). Rotation renames `<file>` → `<file>.1` when the next
 * record would exceed SEEKSTONE_AUDIT_MAX_SIZE (default 10 MB). If a record
 * cannot be written, the tool call is reported as failed with a structured
 * `audit_failed` error — an unauditable write does not pass silently, even
 * though the vault write itself has already landed.
 */

export type AuditOutcome = 'ok' | 'hash_conflict' | 'undo_conflict' | 'policy_denied' | 'error';

export interface AuditFile {
  path: string;
  /** sha-256 of the bytes before the call; null = did not exist; undefined = unknown (journal off). */
  hashBefore?: string | null;
  /** sha-256 of the bytes after the call; null = does not exist. */
  hashAfter: string | null;
}

export interface AuditRecord {
  v: 1;
  ts: string;
  tool: string;
  outcome: AuditOutcome;
  durationMs: number;
  /** Journal seq of the entry this call committed (when the journal is on). */
  seq?: number;
  files?: AuditFile[];
  /** Which policy refused a `policy_denied` call. */
  policy?: 'read_only' | 'read_paths' | 'write_paths' | 'reserved_path' | 'symlink';
  /**
   * Error CODE for non-ok outcomes (`hash_conflict`, `heading_not_found`,
   * `not_found`, `exists`, `invalid_input`, …) — never the message: tool
   * messages can echo headings, patterns, or frontmatter keys, which are
   * content. The full message is in the server log (SEEKSTONE_LOG_FILE).
   */
  error?: string;
  /** Op-specific metadata from the tool result — counts, destinations, flags; never content. */
  [detail: string]: unknown;
}

const DEFAULT_MAX_SIZE = 10 * 1e6;

export interface AuditConfig {
  path: string;
  maxBytes: number;
}

/** Undefined unless SEEKSTONE_AUDIT_FILE is set. */
export function resolveAuditConfig(
  env: Record<string, string | undefined>,
): AuditConfig | undefined {
  const path = (env.SEEKSTONE_AUDIT_FILE ?? '').trim();
  if (path === '') return undefined;
  return { path, maxBytes: parseSize(env.SEEKSTONE_AUDIT_MAX_SIZE, DEFAULT_MAX_SIZE) };
}

export class AuditLog {
  readonly path: string;
  private readonly maxBytes: number;
  private bytes: number; // where this instance last saw the file end
  private torn: boolean; // the file at `bytes` ends partway through a line

  private constructor(path: string, maxBytes: number, bytes: number, torn: boolean) {
    this.path = path;
    this.maxBytes = maxBytes;
    this.bytes = bytes;
    this.torn = torn;
  }

  /**
   * Open (create if missing) the audit file, verifying it is writable now so
   * an unwritable path fails at boot rather than on the first write.
   */
  static open(config: AuditConfig): AuditLog {
    let bytes = 0;
    try {
      bytes = statSync(config.path).size;
    } catch {
      bytes = 0;
    }
    appendFileSync(config.path, '');
    return new AuditLog(config.path, config.maxBytes, bytes, endsTorn(config.path, bytes, false));
  }

  /**
   * Append one record durably; short writes are retried. Throws if the append
   * or fsync fails or a write makes no progress. After a partial line (a crash,
   * a failed write) the record starts with a newline; the last byte is read
   * only if the size moved since our last write. See `truncateTo` on failure.
   */
  record(rec: AuditRecord): void {
    const line = `${JSON.stringify(rec)}\n`;
    const next = (this.torn ? 1 : 0) + Buffer.byteLength(line);
    if (this.bytes > 0 && this.bytes + next > this.maxBytes) {
      renameSync(this.path, `${this.path}.1`);
      this.bytes = 0;
      this.torn = false;
    }
    const fd = openSync(this.path, 'a');
    try {
      const start = fstatSync(fd).size;
      if (start !== this.bytes) this.torn = endsTorn(this.path, start, this.torn);
      const tornBefore = this.torn;
      const out = tornBefore ? `\n${line}` : line;
      const progress = { written: 0 };
      try {
        writeAll(fd, out, progress);
      } catch (err) {
        // The write error is the one reported, whatever happens here.
        this.bytes = start + progress.written;
        this.torn ||= progress.written > 0;
        try {
          // If this fails or skips, the partial line stays.
          if (this.torn && truncateTo(this.path, fd, this.bytes, start)) {
            [this.bytes, this.torn] = [start, tornBefore];
          }
        } catch {}
        throw err;
      }
      // The whole line is in the file now, so count it even if fsync fails.
      this.bytes = start + Buffer.byteLength(out);
      this.torn = false;
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
}

/** Whether the file's last byte isn't a newline; `fallback` if it can't be read. */
function endsTorn(path: string, size: number, fallback: boolean): boolean {
  if (size === 0) return false;
  try {
    const fd = openSync(path, 'r');
    try {
      const buf = Buffer.alloc(1);
      return readSync(fd, buf, 0, 1, size - 1) === 1 ? buf[0] !== 0x0a : fallback;
    } finally {
      closeSync(fd);
    }
  } catch {
    return fallback;
  }
}

/**
 * Cut the file to `len` if `path` is still the file `appendFd` has open and is
 * `size` bytes (not rotated away, no other writer). A separate write-only fd:
 * on Windows the append fd can't ftruncate, and `truncateSync` opens with 'r+'
 * (read access the audit file may not grant).
 */
function truncateTo(path: string, appendFd: number, size: number, len: number): boolean {
  const { dev, ino } = fstatSync(appendFd, { bigint: true }); // NTFS ids exceed 2^53
  const fd = openSync(path, constants.O_WRONLY);
  try {
    const now = fstatSync(fd, { bigint: true });
    const ours = now.dev === dev && now.ino === ino && now.size === BigInt(size);
    if (ours) ftruncateSync(fd, len);
    return ours;
  } finally {
    closeSync(fd);
  }
}

/**
 * Classify a thrown tool error into an audit outcome plus a content-free
 * error code. Structured errors are JSON strings with an `error` field
 * (their code is kept verbatim); policy refusals are plain messages from
 * policy.ts; everything else maps to a coarse code — the raw message is
 * deliberately NOT recorded because tool messages can quote note content
 * (available headings, regex patterns, frontmatter keys).
 */
/** The fixed tail of `assertWritable`'s reserved-folder refusal (policy.ts). */
const RESERVED_PATH_MESSAGE =
  /" is inside \.(?:seekstone|trash)\/, which Seekstone reserves for write history and deleted notes\.$/;

export function classifyError(message: string): {
  outcome: AuditOutcome;
  policy?: AuditRecord['policy'];
  error: string;
} {
  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as { error?: unknown };
      if (typeof parsed.error === 'string') {
        if (parsed.error === 'hash_conflict')
          return { outcome: 'hash_conflict', error: parsed.error };
        if (parsed.error === 'undo_conflict')
          return { outcome: 'undo_conflict', error: parsed.error };
        return { outcome: 'error', error: parsed.error };
      }
    } catch {
      /* not JSON after all — fall through */
    }
  }
  if (message.startsWith('Server is read-only')) {
    return { outcome: 'policy_denied', policy: 'read_only', error: 'read_only' };
  }
  // Symlink refusals (SHA-575) are matched by their exact shape, before the
  // scope checks, since the quoted path can contain any text.
  if (isSymlinkRefusal(message)) {
    return { outcome: 'policy_denied', policy: 'symlink', error: 'symlink' };
  }
  // Match the reserved-path message by its fixed ending, before the scope
  // checks: the quoted path can contain any text, `SEEKSTONE_READ_PATHS` included.
  if (message.startsWith('Write not permitted') && RESERVED_PATH_MESSAGE.test(message)) {
    return { outcome: 'policy_denied', policy: 'reserved_path', error: 'reserved_path' };
  }
  if (message.startsWith('Write not permitted') && message.includes('SEEKSTONE_READ_PATHS')) {
    return { outcome: 'policy_denied', policy: 'read_paths', error: 'read_paths' };
  }
  if (message.startsWith('Write not permitted')) {
    return { outcome: 'policy_denied', policy: 'write_paths', error: 'write_paths' };
  }
  if (/ENOENT|not found/i.test(message)) return { outcome: 'error', error: 'not_found' };
  if (/already exists/i.test(message)) return { outcome: 'error', error: 'exists' };
  if (/^Invalid regex/.test(message)) return { outcome: 'error', error: 'invalid_regex' };
  if (/^Write-safety violation/.test(message))
    return { outcome: 'error', error: 'write_safety_violation' };
  if (/^\[\s*\{/.test(message) || /invalid_type|Required|Expected|expected/.test(message)) {
    return { outcome: 'error', error: 'invalid_input' };
  }
  return { outcome: 'error', error: 'error' };
}
