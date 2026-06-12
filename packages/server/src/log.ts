import { appendFileSync, renameSync, statSync } from 'node:fs';

/**
 * A tiny zero-dependency leveled logger for the MCP server.
 *
 * Two sinks, never stdout (stdout carries the JSON-RPC stdio transport):
 *   - stderr: concise human-readable lines, always on (Claude Desktop captures it).
 *   - file:   JSON-lines, opt-in via SEEKSTONE_LOG_FILE, size-rotated.
 *
 * Privacy: callers pass metadata fields at info/warn/error and only attach note
 * content (bodies, frontmatter values, raw queries) at `debug`. The logger does
 * not inspect or redact fields — that contract lives at the call sites.
 *
 * Note: file writes use appendFileSync. File logging is opt-in and the per-line
 * cost is sub-millisecond, comfortably inside tool latency budgets; the default
 * (stderr-only) path does no disk I/O. An async write queue is a future option.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const ORDER: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'] as const;
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

export interface Logger {
  readonly level: LogLevel;
  error(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  /** Env to read SEEKSTONE_LOG_* from. Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** stderr sink — injectable for tests. Defaults to process.stderr. Never stdout. */
  stderr?: (line: string) => void;
  /** Clock — injectable for deterministic tests. */
  now?: () => Date;
}

function parseLevel(raw: string | undefined, onBad: (m: string) => void): LogLevel {
  if (raw === undefined || raw === '') return 'info';
  const v = raw.trim().toLowerCase();
  for (const lvl of ORDER) {
    if (lvl === v) return lvl;
  }
  onBad(`invalid SEEKSTONE_LOG_LEVEL=${JSON.stringify(raw)}; using "info"`);
  return 'info';
}

function parseSize(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_SIZE;
  const m = /^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/i.exec(raw.trim());
  if (m === null) return DEFAULT_MAX_SIZE;
  const num = Number(m[1]);
  const unit = (m[2] ?? 'b').toLowerCase();
  const mult = unit === 'gb' ? 1e9 : unit === 'mb' ? 1e6 : unit === 'kb' ? 1e3 : 1;
  return Math.max(1, Math.floor(num * mult));
}

function fmtFields(fields: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const env = opts.env ?? process.env;
  // Default sink is stderr — deliberately never process.stdout.
  const stderr = opts.stderr ?? ((line: string): void => void process.stderr.write(line));
  const now = opts.now ?? ((): Date => new Date());

  const level = parseLevel(env.SEEKSTONE_LOG_LEVEL, (m) => {
    stderr(`WARN  ${now().toISOString()} ${m}\n`);
  });
  const threshold = ORDER.indexOf(level);

  const filePath = env.SEEKSTONE_LOG_FILE;
  const maxSize = parseSize(env.SEEKSTONE_LOG_MAX_SIZE);
  let fileOk = false;
  let bytes = 0;
  if (filePath !== undefined && filePath !== '') {
    try {
      try {
        bytes = statSync(filePath).size;
      } catch {
        bytes = 0;
      }
      appendFileSync(filePath, ''); // verify writable / create
      fileOk = true;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      stderr(
        `WARN  ${now().toISOString()} cannot write log file ${filePath}: ${m}; file logging disabled\n`,
      );
    }
  }

  function writeFile(record: Record<string, unknown>): void {
    if (!fileOk || filePath === undefined) return;
    const line = `${JSON.stringify(record)}\n`;
    const len = Buffer.byteLength(line);
    try {
      if (bytes > 0 && bytes + len > maxSize) {
        renameSync(filePath, `${filePath}.1`);
        bytes = 0;
      }
      appendFileSync(filePath, line);
      bytes += len;
    } catch {
      fileOk = false; // stop trying; logging must never crash the request path
    }
  }

  function emit(lvl: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (ORDER.indexOf(lvl) > threshold) return; // below threshold: do no work
    const ts = now().toISOString();
    const f = fields ?? {};
    stderr(`${lvl.toUpperCase().padEnd(5)} ${ts} ${msg}${fmtFields(f)}\n`);
    writeFile({ t: ts, level: lvl, msg, ...f });
  }

  return {
    level,
    error: (m, f) => {
      emit('error', m, f);
    },
    warn: (m, f) => {
      emit('warn', m, f);
    },
    info: (m, f) => {
      emit('info', m, f);
    },
    debug: (m, f) => {
      emit('debug', m, f);
    },
  };
}
