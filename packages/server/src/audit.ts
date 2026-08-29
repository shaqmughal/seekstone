import {
  appendFileSync,
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  statSync,
  writeSync,
} from 'node:fs';
import { parseSize } from './log.js';

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
  policy?: 'read_only' | 'write_paths';
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
  private bytes: number;

  private constructor(path: string, maxBytes: number, bytes: number) {
    this.path = path;
    this.maxBytes = maxBytes;
    this.bytes = bytes;
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
    return new AuditLog(config.path, config.maxBytes, bytes);
  }

  /** Append one record durably. Throws if the append or fsync fails. */
  record(rec: AuditRecord): void {
    const line = `${JSON.stringify(rec)}\n`;
    const len = Buffer.byteLength(line);
    if (this.bytes > 0 && this.bytes + len > this.maxBytes) {
      renameSync(this.path, `${this.path}.1`);
      this.bytes = 0;
    }
    const fd = openSync(this.path, 'a');
    try {
      writeSync(fd, line);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.bytes += len;
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
