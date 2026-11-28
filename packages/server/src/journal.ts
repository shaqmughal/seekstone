import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  type BigIntStats,
  closeSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  truncateSync,
  unlinkSync,
} from 'node:fs';
import { mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { contentHash } from './content-hash.js';
import { envFlag } from './env.js';
import type { Logger } from './log.js';
import { parseSize } from './log.js';
import { writeAll } from './write-all.js';

/**
 * Write journal — the pre-image store behind `list_writes` / `undo_write`.
 *
 * Before any content-modifying write commits, the tool hands the journal the
 * bytes it is about to replace. The journal stores them under
 * `<vault>/.seekstone/history/blobs/<sha256>` (content-addressed: identical
 * states dedupe for free) and appends one JSONL line to
 * `<vault>/.seekstone/history/manifest.jsonl`:
 *
 *   { seq, ts, tool, files: [{ path, preHash, postHash }], undoOf? }
 *
 * `preHash: null` = the file did not exist before (a create); `postHash:
 * null` = it does not exist after (a delete or move-away). Only pre-images
 * are stored — the post-state is what is on disk.
 *
 * Durability: blobs and the manifest line are fsync'd before the tool is
 * allowed to touch the vault. A crash after the journal commit but before
 * the vault write leaves an entry whose postHash does not match disk —
 * undo_write reports that as a conflict rather than restoring blindly. A
 * journal failure throws, which aborts the vault write — an unjournalable
 * write does not proceed while the journal is enabled.
 *
 * Retention is size-capped (`SEEKSTONE_HISTORY_MAX_SIZE`, default 50 MB of
 * blobs) and count-capped (`SEEKSTONE_HISTORY_MAX_ENTRIES`, default 1000).
 * Over the size cap, eviction drops the oldest entries' blobs; the entry stays
 * listed with `undoable: false`. Over the entry cap, the oldest rows are
 * deleted from the manifest along with their blobs, so they stop being listed
 * (WRITE-SAFETY, retention). `SEEKSTONE_HISTORY=0`
 * disables the journal entirely (ctx.journal is undefined; tools skip it).
 *
 * Several server processes can share a vault. Every manifest change holds
 * `manifest.lock` and first reads what others appended; reads need no lock.
 * The lock protocol is described above `withLock`.
 */

export interface JournalFile {
  /** Vault-relative path. */
  path: string;
  /** sha-256 of the bytes before the write; null when the file did not exist. */
  preHash: string | null;
  /** sha-256 of the bytes after the write; null when the file no longer exists. */
  postHash: string | null;
}

export interface JournalEntry {
  /** Monotonic, 1-based, never reused within a vault's journal. */
  seq: number;
  /** ISO-8601 timestamp of the commit. */
  ts: string;
  /** Tool that performed the write (`undo_write` for undos). */
  tool: string;
  files: JournalFile[];
  /** For undo entries: the seq this entry reverted. */
  undoOf?: number;
}

/**
 * The tool name of a void row: it stands in for a row whose append failed
 * and was rolled back, and keeps that row's seq so it is never reused.
 */
export const VOID_TOOL = 'void';

/** True for a void row (`VOID_TOOL`, no files): a failed write that changed nothing. */
export function isVoid(entry: JournalEntry): boolean {
  return entry.tool === VOID_TOOL && entry.files.length === 0;
}

/** A listed entry: the manifest row plus whether its pre-images are still on disk. */
export interface JournalListRow {
  seq: number;
  ts: string;
  tool: string;
  paths: string[];
  undoable: boolean;
  undoOf?: number;
}

export interface JournalConfig {
  maxBytes: number;
  maxEntries: number;
}

const DEFAULT_MAX_BYTES = 50 * 1e6;
const DEFAULT_MAX_ENTRIES = 1000;

/** Vault-relative directory the journal lives in — excluded from indexing like `.trash/`. */
export const HISTORY_DIR = '.seekstone/history';

/**
 * A lock whose owner can't be checked (no body yet, or held from another
 * host) is reclaimed once its file is this old. A live owner on this host
 * keeps its lock however old it is.
 */
const LOCK_STALE_MS = 30_000;
/** How long a commit waits for the lock before failing. */
const LOCK_WAIT_MS = 2 * LOCK_STALE_MS;
const LOCK_RETRY_MS = 5;
const HOST = hostname();
/** Lock tokens are `{pid, host, id, ts}`; `id` is unique per acquisition. */
const TOKEN_HEAD = `{"pid":${process.pid},"host":${JSON.stringify(HOST)},"id":"${randomBytes(8).toString('hex')}-`;
let tokenCount = 0;
/** A fresh lock or claim token. Never reused, so an abandoned one stays recognisable. */
function newToken(): string {
  return `${TOKEN_HEAD}${++tokenCount}","ts":${Date.now()}}`;
}
/** Lock and claim files this process created and then gave up on (by exact identity). */
const abandoned = new Set<string>();

/**
 * Read the journal settings from env. Returns undefined when the journal is
 * disabled (`SEEKSTONE_HISTORY=0|false|no|off`).
 */
export function resolveJournalConfig(
  env: Record<string, string | undefined>,
): JournalConfig | undefined {
  if (!envFlag(env.SEEKSTONE_HISTORY, true)) return undefined;
  const maxEntriesRaw = Number.parseInt(env.SEEKSTONE_HISTORY_MAX_ENTRIES ?? '', 10);
  return {
    maxBytes: parseSize(env.SEEKSTONE_HISTORY_MAX_SIZE, DEFAULT_MAX_BYTES),
    maxEntries:
      Number.isFinite(maxEntriesRaw) && maxEntriesRaw > 0 ? maxEntriesRaw : DEFAULT_MAX_ENTRIES,
  };
}

const TMP_TAG = `${process.pid}${randomBytes(4).toString('hex')}`;
let tmpCount = 0;

/**
 * Write `content` to `dest` durably: temp file, fsync, rename over. Each call
 * gets its own temp file, created exclusively, because another server
 * process may be storing the same blob at the same moment. On failure we
 * remove only the temp file this call created. Sync calls, like
 * `appendDurable`: each async call costs a thread-pool round trip.
 */
function writeDurable(dest: string, content: string): void {
  const tmp = join(dirname(dest), `.${basename(dest)}.${TMP_TAG}${++tmpCount}.seekstone-tmp`);
  const fd = openSync(tmp, 'wx');
  try {
    try {
      writeAll(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, dest);
  } catch (err) {
    unlinkLock(tmp);
    throw err;
  }
}

/**
 * An inode that compares exactly. As a number, an inode past 2^53 (NTFS file
 * ids usually are) is rounded, and two files can look the same; then a
 * second, bigint stat gives the exact id. A safe number is kept as it is, so
 * the usual case costs no extra stat and no BigInt allocation.
 */
function exactIno(ino: number, exact: () => bigint | undefined): number | bigint {
  return Number.isSafeInteger(ino) ? ino : (exact() ?? ino);
}

/** Sync calls, as in `AuditLog.record`: cheaper than four thread-pool round trips. */
function appendDurable(dest: string, data: Buffer): void {
  const fd = openSync(dest, 'a');
  try {
    writeAll(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * One tool call's worth of journaling. `add` stores each file's pre-image;
 * `commit` appends the manifest line. Tools call both BEFORE the first vault
 * byte changes. Multi-file tools (move_note, rename_heading) add every
 * touched file under one seq so undo restores all of them or none.
 */
export interface JournalTxn {
  add(path: string, pre: string | null, post: string | null): Promise<void>;
  commit(): Promise<JournalEntry>;
}

export class Journal {
  readonly config: JournalConfig;
  private readonly dir: string;
  private readonly blobDir: string;
  private readonly manifestPath: string;
  private readonly lockPath: string;
  private readonly log?: Logger;
  private entries: JournalEntry[] = [];
  private nextSeq = 1;
  /** Identity and length of the manifest as last read; a new inode means it was compacted. */
  /** The manifest's inode, exact (see `exactIno`). */
  private manifestIno: number | bigint = -1;
  private manifestOffset = 0;
  /** Bytes after the last newline: an append in flight, or torn by a crash. */
  private tailBytes = 0;
  /**
   * The last complete line we read, ending at `manifestOffset`. A rolled-back
   * row can be replaced by one of the same length and seq, so inode and size
   * don't prove our cache is current; these bytes still being there does.
   */
  private lastLine: Buffer = Buffer.alloc(0);
  /** Blob hash → byte size, for every blob currently on disk. */
  private readonly blobSizes: Map<string, number>;
  private totalBytes: number;
  /** A refresh's scan for evicted blobs threw; the next refresh runs it again. */
  private blobScanPending = false;
  /** Blobs of rows we read whose stat failed before we cached them; retried on refresh. */
  private readonly unstatted = new Set<string>();
  /** `open` has loaded the manifest; until then, cached blob sizes are fresh from disk. */
  private opened = false;
  /** Serialises commits so seq assignment and eviction never interleave. */
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(
    vaultRoot: string,
    config: JournalConfig,
    blobSizes: Map<string, number>,
    log?: Logger,
  ) {
    this.config = config;
    this.dir = join(vaultRoot, HISTORY_DIR);
    this.blobDir = join(this.dir, 'blobs');
    this.manifestPath = join(this.dir, 'manifest.jsonl');
    this.lockPath = join(this.dir, 'manifest.lock');
    this.blobSizes = blobSizes;
    this.totalBytes = 0;
    for (const n of blobSizes.values()) this.totalBytes += n;
    this.log = log;
  }

  /** Open (or create) the journal under `vaultRoot`, loading the manifest into memory. */
  static async open(
    vaultRoot: string,
    config: JournalConfig,
    opts: { log?: Logger } = {},
  ): Promise<Journal> {
    const dir = join(vaultRoot, HISTORY_DIR);
    const blobDir = join(dir, 'blobs');
    await mkdir(blobDir, { recursive: true });

    const blobSizes = new Map<string, number>();
    for (const name of await readdir(blobDir)) {
      if (!/^[0-9a-f]{64}$/.test(name)) continue;
      try {
        blobSizes.set(name, (await stat(join(blobDir, name))).size);
      } catch {
        /* vanished between readdir and stat — treat as absent */
      }
    }
    const journal = new Journal(vaultRoot, config, blobSizes, opts.log);
    await journal.enqueue(() => journal.load());
    journal.opened = true;
    // A torn last line from a crash: not listed; the next commit cuts it off.
    if (journal.tailBytes > 0) opts.log?.warn('journal: skipping malformed manifest line');
    return journal;
  }

  /** Read what other processes appended or compacted since we last looked. True if anything. */
  refresh(): Promise<boolean> {
    return this.enqueue(async () => {
      // A scan that threw last time runs again: `load` already moved past the
      // rows that called for it, so it won't report them a second time.
      if (!(await this.load()) && !this.blobScanPending && this.unstatted.size === 0) return false;
      // Another process committed, and may have evicted blobs we know of.
      this.blobScanPending = true;
      this.forgetMissingBlobs();
      this.blobScanPending = false;
      // Until a blob is cached its entry lists as not undoable, so a stat
      // that failed while reading its row is tried again here.
      for (const hash of this.unstatted) {
        let size: number | undefined;
        try {
          size = statSync(join(this.blobDir, hash), { throwIfNoEntry: false })?.size;
        } catch {
          continue;
        }
        this.unstatted.delete(hash);
        if (size === undefined || this.blobSizes.has(hash)) continue;
        this.blobSizes.set(hash, size);
        this.totalBytes += size;
      }
      return true;
    });
  }

  /**
   * Read every cached blob's size from disk again (under the lock). Cached
   * sizes can be wrong: a blob changed outside Seekstone, or another process
   * repaired one in a commit whose row it then rolled back. False if any
   * stat fails (that blob's cached size is kept).
   */
  private measureBlobs(): boolean {
    for (const [hash, cached] of this.blobSizes) {
      let size: number | undefined;
      try {
        size = statSync(join(this.blobDir, hash), { throwIfNoEntry: false })?.size;
      } catch {
        return false;
      }
      if (size === undefined) this.blobSizes.delete(hash);
      else this.blobSizes.set(hash, size);
      this.totalBytes += (size ?? 0) - cached;
    }
    return true;
  }

  /** Drop cached blobs that are no longer on disk (evicted by another process). */
  private forgetMissingBlobs(): void {
    const onDisk = new Set(readdirSync(this.blobDir));
    for (const [hash, size] of this.blobSizes) {
      if (onDisk.has(hash)) continue;
      this.blobSizes.delete(hash);
      this.totalBytes -= size;
    }
  }

  /** One (sync) stat when nothing changed. Only whole lines are read. */
  private async load(reread = false): Promise<boolean> {
    const known = this.manifestOffset + this.tailBytes;
    const now = statSync(this.manifestPath, { throwIfNoEntry: false });
    if (!now) return false;
    const ino = exactIno(
      now.ino,
      () => statSync(this.manifestPath, { throwIfNoEntry: false, bigint: true })?.ino,
    );
    if (!reread && ino === this.manifestIno && now.size === known) return false;
    const fh = await open(this.manifestPath, 'r');
    let buf: Buffer;
    let start: number;
    try {
      const st = await fh.stat();
      const stIno = Number.isSafeInteger(st.ino) ? st.ino : (await fh.stat({ bigint: true })).ino;
      const read = async (from: number): Promise<Buffer> => {
        const b = Buffer.alloc(st.size - from);
        return b.subarray(0, (await fh.read(b, 0, b.length, from)).bytesRead);
      };
      let replaced = stIno !== this.manifestIno || st.size < this.manifestOffset;
      start = replaced ? 0 : this.manifestOffset - this.lastLine.length;
      buf = await read(start);
      if (!replaced) {
        // Our last line must still be there, or the rows after it were rolled
        // back and rewritten: read from the start, or we'd read mid-row.
        const n = this.lastLine.length;
        if (buf.subarray(0, n).equals(this.lastLine)) {
          buf = buf.subarray(n);
          start += n;
        } else {
          replaced = true;
          start = 0;
          buf = await read(0);
        }
      }
      if (replaced) {
        this.entries = [];
        this.manifestIno = stIno;
        this.lastLine = Buffer.alloc(0);
      }
    } finally {
      await fh.close();
    }
    const end = buf.lastIndexOf(0x0a) + 1;
    if (end > 0) {
      // (A negative offset would count from the end of the buffer.)
      const from = end > 1 ? buf.lastIndexOf(0x0a, end - 2) + 1 : 0;
      this.lastLine = Buffer.from(buf.subarray(from, end));
    }
    this.manifestOffset = start + end;
    this.tailBytes = buf.length - end;
    await this.ingest(buf.subarray(0, end).toString('utf8'), start === 0);
    return true;
  }

  /**
   * Under the lock, before trusting the cache: is our last line still on
   * disk where we read it? The size check in `load` can't see a rolled-back
   * row replaced by one of the same length.
   */
  private lastLineOnDisk(): boolean {
    const n = this.lastLine.length;
    if (n === 0) return true;
    let fd: number;
    try {
      fd = openSync(this.manifestPath, 'r');
    } catch {
      return false;
    }
    try {
      const buf = Buffer.alloc(n);
      return readSync(fd, buf, 0, n, this.manifestOffset - n) === n && buf.equals(this.lastLine);
    } finally {
      closeSync(fd);
    }
  }

  /** Parse complete manifest lines and add their entries (and their blobs' sizes). */
  private async ingest(text: string, fromStart: boolean): Promise<void> {
    let lastSeq = fromStart ? 0 : this.nextSeq - 1;
    // Rows from here on are new to this process. A full reread after another
    // process compacts brings back rows we already had; their blobs keep the
    // sizes we know, so only new rows pay for a stat.
    const firstNew = this.nextSeq;
    const checked = new Set<string>();
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // A torn trailing line from a crash mid-append — the write it
        // described simply is not listed. Never fail boot over it.
        this.log?.warn('journal: skipping malformed manifest line');
        continue;
      }
      if (!isEntry(parsed) || parsed.seq <= lastSeq) {
        this.log?.warn('journal: skipping invalid manifest entry');
        continue;
      }
      this.entries.push(parsed);
      lastSeq = parsed.seq;
      // Kept in step with `entries` row by row: `load` has already moved the
      // manifest offset past these rows, so a throw below must not leave a
      // listed seq that the next commit would hand out again.
      this.nextSeq = Math.max(this.nextSeq, lastSeq + 1);
      for (const f of parsed.files) {
        if (f.preHash === null || checked.has(f.preHash)) continue;
        const cached = this.blobSizes.get(f.preHash);
        // After `open`, stat a cached blob again for a new row: the process
        // that wrote it may have rewritten a damaged copy. (`open` just read
        // the sizes.) An older row keeps its cached size; byte-cap eviction
        // checks a blob's real size before it deletes it.
        if (cached !== undefined && (!this.opened || parsed.seq < firstNew)) continue;
        checked.add(f.preHash);
        // Missing means already evicted: the entry lists as not undoable.
        // Any other error (EIO, EACCES) keeps what we knew: commit checks a
        // blob again before it reuses it, and byte-cap eviction measures
        // every blob before it deletes any.
        let size: number | undefined;
        try {
          size = statSync(join(this.blobDir, f.preHash), { throwIfNoEntry: false })?.size;
        } catch {
          if (cached === undefined) this.unstatted.add(f.preHash);
          continue;
        }
        if (size === undefined) continue;
        this.unstatted.delete(f.preHash);
        this.blobSizes.set(f.preHash, size);
        this.totalBytes += size - (cached ?? 0);
      }
    }
  }

  begin(tool: string, undoOf?: number): JournalTxn {
    const files: JournalFile[] = [];
    const preimages = new Map<string, string>();
    let committed = false;
    return {
      add: async (path, pre, post) => {
        if (committed) throw new Error('journal: add after commit');
        const preHash = pre === null ? null : this.storeBlob(pre);
        if (preHash !== null && pre !== null) preimages.set(preHash, pre);
        files.push({ path, preHash, postHash: post === null ? null : contentHash(post) });
      },
      commit: async () => {
        if (committed) throw new Error('journal: double commit');
        committed = true;
        return this.enqueue(() => this.withLock(() => this.commit(tool, files, preimages, undoOf)));
      },
    };
  }

  /** Newest-first rows for `list_writes`. */
  /**
   * Newest-first metadata rows. `visible` hides entries that touched any path
   * it rejects (the read scope, SHA-291 D3); hidden entries don't count
   * toward `total` either.
   */
  list(opts: { limit?: number; path?: string; visible?: (path: string) => boolean } = {}): {
    writes: JournalListRow[];
    total: number;
  } {
    const limit = opts.limit ?? 20;
    const { path, visible } = opts;
    // Void rows are failed writes that changed nothing: never listed.
    const filtered = this.entries.filter(
      (e) =>
        !isVoid(e) &&
        (path === undefined || e.files.some((f) => f.path === path)) &&
        (visible === undefined || e.files.every((f) => visible(f.path))),
    );
    const writes: JournalListRow[] = [];
    for (let i = filtered.length - 1; i >= 0 && writes.length < limit; i--) {
      const e = filtered[i] as JournalEntry;
      const row: JournalListRow = {
        seq: e.seq,
        ts: e.ts,
        tool: e.tool,
        paths: e.files.map((f) => f.path),
        undoable: this.isUndoable(e),
      };
      if (e.undoOf !== undefined) row.undoOf = e.undoOf;
      writes.push(row);
    }
    return { writes, total: filtered.length };
  }

  /** Seq of the newest entry (0 when empty). */
  get lastSeq(): number {
    return this.nextSeq - 1;
  }

  /** Entries committed after `seq`, oldest first. */
  since(seq: number): JournalEntry[] {
    return this.entries.filter((e) => e.seq > seq);
  }

  get(seq: number): JournalEntry | undefined {
    return this.entries.find((e) => e.seq === seq);
  }

  /**
   * The most recent write that is still in effect and restorable — the
   * default target of `undo_write`. Undo entries and writes they reverted are
   * skipped (so repeated default undos walk backwards instead of ping-ponging
   * undo/redo); an undo that was itself undone re-exposes its target. Redo is
   * always explicit: `undo_write({ seq: <the undo's seq> })`.
   */
  latestUndoable(visible?: (path: string) => boolean): JournalEntry | undefined {
    const cancelled = new Set<number>();
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i] as JournalEntry;
      if (isVoid(e)) continue;
      if (visible && !e.files.every((f) => visible(f.path))) continue;
      if (cancelled.has(e.seq)) continue;
      if (e.undoOf !== undefined) {
        cancelled.add(e.undoOf);
        continue;
      }
      if (this.isUndoable(e)) return e;
    }
    return undefined;
  }

  isUndoable(entry: JournalEntry): boolean {
    return entry.files.every((f) => f.preHash === null || this.blobSizes.has(f.preHash));
  }

  /** Read a stored pre-image by hash. Throws (code ENOENT) if evicted. */
  async preimage(hash: string): Promise<string> {
    let raw: string;
    try {
      raw = await readFile(join(this.blobDir, hash), 'utf8');
    } catch (err) {
      raw = await this.rereadBlob(hash, err);
    }
    // Integrity check on the stored blob (not a secret comparison); the
    // constant-time compare is free and keeps static analysis quiet.
    const actual = Buffer.from(contentHash(raw), 'hex');
    const expected = Buffer.from(hash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error(`journal: blob ${hash} is corrupt (hash mismatch)`);
    }
    return raw;
  }

  /**
   * After a blob read failed with ENOENT. If the blob is absent, it was
   * evicted: drop it from the cache and rethrow `first` (undo_write reports
   * entry_evicted). If it is there, a commit restored it: read it again. If
   * it keeps vanishing and reappearing, throw a retryable error instead, so
   * a blob that exists is never reported as evicted.
   */
  private async rereadBlob(hash: string, first: unknown): Promise<string> {
    if ((first as NodeJS.ErrnoException).code !== 'ENOENT') throw first;
    const path = join(this.blobDir, hash);
    let err = first;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!statSync(path, { throwIfNoEntry: false })) {
        this.totalBytes -= this.blobSizes.get(hash) ?? 0;
        this.blobSizes.delete(hash);
        throw err;
      }
      try {
        return await readFile(path, 'utf8');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        err = e;
      }
    }
    throw new Error(
      `journal: pre-image ${hash} is being evicted and restored by another process; try again`,
    );
  }

  /** Bytes of pre-images currently stored (for diagnostics/tests). */
  get storedBytes(): number {
    return this.totalBytes;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private storeBlob(content: string): string {
    const hash = contentHash(content);
    if (this.blobSizes.has(hash)) return hash;
    const path = join(this.blobDir, hash);
    try {
      writeDurable(path, content);
    } catch (err) {
      // Another process stored the same blob at the same moment (Windows
      // refuses a rename onto a file another rename is placing). Blobs are
      // content-addressed, so theirs will do if its bytes hash right.
      if (!blobMatches(path, hash)) throw err;
    }
    // A concurrent add of the same pre-image may have counted it meanwhile.
    if (this.blobSizes.has(hash)) return hash;
    const size = Buffer.byteLength(content, 'utf8');
    this.blobSizes.set(hash, size);
    this.totalBytes += size;
    return hash;
  }

  /** Called with the lock held. */
  private async commit(
    tool: string,
    files: JournalFile[],
    preimages: Map<string, string>,
    undoOf?: number,
  ): Promise<JournalEntry> {
    // With a torn tail on record, reread past the last complete line rather
    // than trust the size: another process may have cut it off and appended
    // a whole row of exactly the same length. The same goes for a row another
    // process rolled back and replaced: then reread from the start.
    if (!this.lastLineOnDisk()) this.manifestIno = -1;
    await this.load(this.tailBytes > 0);
    // A blob stored before the lock may have been evicted since by another
    // process (shared with an old entry). Our cache can't tell: a refresh may
    // have read that process's manifest line before it removed the blob. So
    // check the disk, under the lock, where no eviction can be in progress.
    for (const [hash, content] of preimages) {
      const path = join(this.blobDir, hash);
      const st = statSync(path, { throwIfNoEntry: false });
      if (st) {
        // The wrong size means the blob was damaged outside Seekstone (a
        // same-size change is caught by `preimage` at undo time). Rewrite it,
        // or this entry could never be undone.
        const size = Buffer.byteLength(content, 'utf8');
        if (st.size !== size) {
          try {
            writeDurable(path, content);
          } catch (err) {
            // As in `storeBlob`: another process may have placed it meanwhile.
            if (!blobMatches(path, hash)) throw err;
          }
        }
        this.totalBytes += size - (this.blobSizes.get(hash) ?? 0);
        this.blobSizes.set(hash, size);
        continue;
      }
      this.totalBytes -= this.blobSizes.get(hash) ?? 0;
      this.blobSizes.delete(hash);
      this.storeBlob(content);
    }
    const entry: JournalEntry = { seq: this.nextSeq, ts: new Date().toISOString(), tool, files };
    if (undoOf !== undefined) entry.undoOf = undoOf;
    // A torn last line (a failed or crashed append) is cut off first, under
    // the lock: completing it with a newline could turn it into a valid row
    // that duplicates this entry's seq.
    if (this.tailBytes > 0) {
      truncateSync(this.manifestPath, this.manifestOffset);
      this.tailBytes = 0;
    }
    const line = Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8');
    try {
      appendDurable(this.manifestPath, line);
    } catch (err) {
      // Part of the line, or all of it, may be on disk, and the caller won't
      // write the note. Replace it so it never loads as committed.
      if (this.rollBackAppend(entry)) await this.evictOrWarn(true);
      throw err;
    }
    this.manifestOffset += line.length;
    this.lastLine = line;
    this.nextSeq++;
    this.entries.push(entry);
    await this.evictOrWarn();
    return entry;
  }

  private async evictOrWarn(afterVoid = false): Promise<void> {
    try {
      await this.evict(afterVoid);
    } catch (err) {
      // The row is committed, so this doesn't fail the call. The old rows are
      // still in the manifest: reread it, and the next commit compacts again.
      this.manifestIno = -1;
      this.log?.warn('journal: manifest compaction failed; retrying on the next write', {
        error: String(err),
      });
    }
  }

  /**
   * Called with the lock held, after a failed append. Never throws: the
   * caller reports the append's error. The failed row (always the last line)
   * is cut off and replaced by a void row with the same seq, so no process
   * hands that seq out again, even one that listed the failed row or an
   * older server (a void row is a valid entry with no files). The result is
   * fsynced, or a crash could bring the row back. If the void row can't be
   * written, the cut alone stays and the seq is free again (returns false).
   */
  private rollBackAppend(failed: JournalEntry): boolean {
    const entry: JournalEntry = { seq: failed.seq, ts: failed.ts, tool: VOID_TOOL, files: [] };
    const line = Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8');
    try {
      const fd = openSync(this.manifestPath, 'r+');
      try {
        ftruncateSync(fd, this.manifestOffset);
        try {
          writeAll(fd, line, { written: 0 }, this.manifestOffset);
          fsyncSync(fd);
          this.manifestOffset += line.length;
          this.lastLine = line;
          this.nextSeq++;
          this.entries.push(entry);
          return true;
        } catch (err) {
          this.log?.warn('journal: could not write a void row to roll back a failed append', {
            error: String(err),
          });
        }
        // No partial void row may stay: it would be a torn line.
        ftruncateSync(fd, this.manifestOffset);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    } catch (err) {
      // The row may stay. Reread the manifest from the start next time
      // instead of trusting our offsets.
      this.manifestIno = -1;
      this.log?.warn('journal: could not roll back a failed manifest append', {
        error: String(err),
      });
    }
    return false;
  }

  /**
   * The manifest lock. Acquire: create `manifest.lock` exclusively (O_EXCL)
   * and write a token `{pid, host, id, ts}`; release: unlink it. Every
   * attempt uses a fresh token.
   *
   * A waiting process removes someone else's lock only when its owner is
   * gone: a pid on this host that no longer runs. A live owner keeps the lock
   * however long it pauses, so two processes never both think they hold it.
   * Age decides only where liveness can't be checked: a lock with no token
   * (its owner died between create and write) or one held from another host
   * is reclaimed when its file is older than LOCK_STALE_MS, measured from
   * before the file was read.
   *
   * So a creator that took more than half of LOCK_STALE_MS between creating
   * a lock or claim file and writing its token never uses that file: a
   * waiter may already be removing it. It records the file as abandoned
   * (this process then treats it as gone), removes it if it can, and tries
   * again. A creator that wrote in time is safe: no waiter could have judged
   * its file stale before the token appeared.
   *
   * Removing a lock by path is racy on its own: two waiters can judge the
   * same dead lock, and the slower one would delete the lock the faster one
   * just took. So a remover first creates a claim file, again with O_EXCL,
   * named after that file's identity (device, inode and birth time). Only
   * one process can hold it. Holding the claim, it reads the file again and
   * unlinks it only if it is the same file and its owner is still gone,
   * then deletes the claim. Nothing else can remove or replace the file
   * meanwhile: removers need the same claim, live owners are never judged
   * gone, and an exclusive create fails while the file exists. A claim left
   * behind by a process that died or gave up is removed the same way, deepest
   * first, so a chain of them always makes progress. Everything here is sync,
   * which also suits Windows: there an unlinked file can linger briefly and
   * creates fail with EPERM, which we treat like EEXIST.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const deadline = Date.now() + LOCK_WAIT_MS;
    let token: string;
    for (;;) {
      token = newToken();
      if (tryCreate(this.lockPath, token)) break;
      const seen = inspectLock(this.lockPath);
      let retryNow = false;
      if (seen && ownerGone(seen)) {
        this.log?.warn('journal: reclaiming the history lock of a process that is gone', {
          owner: seen.body,
        });
        retryNow = removeIfUnchanged(this.lockPath, seen);
      }
      // Every pass checks the deadline, immediate retries included.
      if (Date.now() > deadline) {
        throw new Error(
          `journal: timed out waiting for the history lock ${this.lockPath} (held by ${seen?.body || 'unknown'}). ` +
            'If that process is not a running seekstone server, stop every seekstone server that shares this vault, then delete the file.',
        );
      }
      if (!retryNow) await sleep(LOCK_RETRY_MS);
    }
    const acquired = Date.now();
    try {
      return await fn();
    } finally {
      // Only a lock held from another host can be reclaimed while its owner
      // lives, and only once LOCK_STALE_MS old; check the token past that.
      if (Date.now() - acquired < LOCK_STALE_MS || holdsToken(this.lockPath, token)) {
        unlinkLock(this.lockPath);
      }
    }
  }

  /**
   * Enforce the caps. Blobs are reference-counted across entries, so a
   * pre-image shared by an old and a new entry survives the old one's
   * eviction. Over the entry cap, the oldest rows are dropped and the
   * manifest rewritten atomically; over the byte cap, the oldest entries'
   * blobs are removed but the rows stay (listed as undoable: false).
   * After a void row, keep the newest real entry and the rows after it, and
   * leave the byte cap (it counts the failed write's pre-images) to the next commit.
   */
  private async evict(afterVoid = false): Promise<void> {
    const refs = new Map<string, number>();
    for (const e of this.entries) {
      for (const f of e.files) {
        if (f.preHash !== null) refs.set(f.preHash, (refs.get(f.preHash) ?? 0) + 1);
      }
    }
    const dropBlobs = async (e: JournalEntry): Promise<void> => {
      for (const f of e.files) {
        if (f.preHash === null) continue;
        const n = (refs.get(f.preHash) ?? 1) - 1;
        refs.set(f.preHash, n);
        if (n > 0 || !this.blobSizes.has(f.preHash)) continue;
        await rm(join(this.blobDir, f.preHash), { force: true });
        this.totalBytes -= this.blobSizes.get(f.preHash) ?? 0;
        this.blobSizes.delete(f.preHash);
      }
    };

    let rewrite = false;
    let droppable = this.entries.length;
    if (afterVoid) droppable = this.entries.findLastIndex((e) => !isVoid(e));
    if (droppable < 0) droppable = this.entries.length - 1;
    while (this.entries.length > this.config.maxEntries && droppable-- > 0) {
      const oldest = this.entries.shift() as JournalEntry;
      await dropBlobs(oldest);
      rewrite = true;
    }
    // Never evict the entry just committed — a write must be undoable at
    // least until the next one lands, whatever the cap. The byte cap counts
    // real sizes: over it, every blob is measured on disk first, so a cached
    // size that's too high can't delete undo history the cap allows. If a
    // size can't be read, nothing is evicted for size (the entry cap still
    // applies): keeping history beats deleting it on a guess.
    const sized = !afterVoid && (this.totalBytes <= this.config.maxBytes || this.measureBlobs());
    for (
      let i = 0;
      sized && this.totalBytes > this.config.maxBytes && i < this.entries.length - 1;
      i++
    ) {
      await dropBlobs(this.entries[i] as JournalEntry);
    }
    if (rewrite) {
      const lines = this.entries.map((e) => `${JSON.stringify(e)}\n`);
      writeDurable(this.manifestPath, lines.join(''));
      const st = statSync(this.manifestPath);
      this.manifestIno = exactIno(st.ino, () => statSync(this.manifestPath, { bigint: true }).ino);
      this.manifestOffset = st.size;
      this.lastLine = Buffer.from(lines.at(-1) ?? '', 'utf8');
      this.log?.debug('journal: manifest compacted', { entries: this.entries.length });
    }
  }
}

function unlinkLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/** Create `path` exclusively with `body`. False if it already exists. */
function tryCreate(path: string, body: string, cleanUp = true): boolean {
  // A monotonic clock: a wall-clock step back must not hide a long stall.
  const before = performance.now();
  let fd: number;
  try {
    fd = openSync(path, 'wx');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Windows reports EPERM while another process is deleting the file.
    if (code === 'EEXIST' || (code === 'EPERM' && process.platform === 'win32')) return false;
    throw err;
  }
  let inTime: boolean;
  try {
    writeAll(fd, body);
    // Written within half of LOCK_STALE_MS of the create: no waiter can have
    // judged this file stale while it had no token.
    inTime = performance.now() - before < LOCK_STALE_MS / 2;
  } catch (err) {
    abandon(path, fd, cleanUp);
    throw err;
  }
  if (inTime) {
    closeSync(fd);
    return true;
  }
  abandon(path, fd, cleanUp);
  return false;
}

/**
 * Give up on a file we just created at `path` (fd still open). It is never
 * used. We remember it as abandoned, which lets this process remove it
 * through the claim protocol now or on its next attempt; other processes
 * reclaim it by age or once we exit. Nothing here unlinks by path alone.
 */
function abandon(path: string, fd: number, cleanUp: boolean): void {
  let mine: LockSnapshot | undefined;
  try {
    // While our fd is open its inode can't be reused, so a matching identity
    // means the path still names our file.
    const snap = inspectLock(path);
    if (snap && snap.key === fileKey(fstatSync(fd, { bigint: true }))) {
      mine = snap;
      abandoned.add(snap.exact);
    }
  } finally {
    closeSync(fd);
  }
  if (mine && cleanUp) {
    try {
      // cleanUp: false, so a claim that fails the same way can't recurse.
      removeIfUnchanged(path, mine, false);
    } catch {
      /* left for the next attempt, or for age-based recovery */
    }
  }
}

/** True if the blob at `path` exists and its bytes hash to `hash`. */
function blobMatches(path: string, hash: string): boolean {
  try {
    // Hash the raw bytes: decoding first would map invalid UTF-8 to U+FFFD.
    const actual = Buffer.from(contentHash(readFileSync(path)), 'hex');
    return actual.equals(Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

/** True if the file at `path` holds exactly `token`. */
function holdsToken(path: string, token: string): boolean {
  const body = inspectLock(path)?.body;
  return body !== undefined && Buffer.from(body, 'utf8').equals(Buffer.from(token, 'utf8'));
}

/** @internal Exported for tests. */
export interface LockSnapshot {
  body: string;
  mtimeMs: number;
  /** Date.now() taken before the file was read: ages are measured from here. */
  at: number;
  /** The file's identity (device, inode, birth time): names its claim. */
  key: string;
  /** Identity plus mtime and body: this exact state of the file. */
  exact: string;
}

/** A file's identity, stable across writes to it. */
function fileKey(st: BigIntStats): string {
  return contentHash(`${st.dev}:${st.ino}:${st.birthtimeNs}`).slice(0, 32);
}

/** Read a lock or claim file. Undefined if it is gone (or unreadable for now). @internal */
export function inspectLock(path: string): LockSnapshot | undefined {
  const at = Date.now();
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return undefined;
  }
  try {
    const st = fstatSync(fd, { bigint: true });
    const buf = Buffer.alloc(Math.min(Number(st.size), 4096));
    const body = buf.toString('utf8', 0, readSync(fd, buf, 0, buf.length, 0));
    const key = fileKey(st);
    const exact = contentHash(`${key}:${st.mtimeNs}:${body}`);
    return { body, mtimeMs: Number(st.mtimeMs), at, key, exact };
  } catch {
    return undefined;
  } finally {
    closeSync(fd);
  }
}

/**
 * True when the file's owner can no longer release it: a dead pid on this
 * host, or (when that can't be checked) a file older than LOCK_STALE_MS.
 * Tokens without a host come from older releases, which ran on this host.
 */
function ownerGone(snap: LockSnapshot): boolean {
  if (abandoned.has(snap.exact)) return true;
  let owner: { pid?: unknown; host?: unknown } | undefined;
  try {
    owner = JSON.parse(snap.body);
  } catch {
    /* no token yet, or a torn one: fall back to age */
  }
  const pid = owner?.pid;
  const local = owner?.host === undefined || owner.host === HOST;
  if (local && typeof pid === 'number' && Number.isInteger(pid) && pid > 0) return !pidAlive(pid);
  return snap.at - snap.mtimeMs > LOCK_STALE_MS;
}

/**
 * Unlink `path` if it is still the file `seen` describes and its owner is
 * still gone, holding a claim so no other process can remove it (or its
 * replacement) at the same time. A claim left by a process that died or gave
 * up is cleared first, deepest first. True when the caller should retry the
 * lock at once. @internal
 */
export function removeIfUnchanged(path: string, seen: LockSnapshot, cleanUp = true): boolean {
  const base = path.replace(/(\.[0-9a-f]{32}\.claim)+$/, '');
  let target = path;
  let snap = seen;
  // No fixed depth: a chain only gets longer when a process dies or gives up
  // mid-claim, and each step is a different file on disk. The visited set
  // keeps the walk finite even if names ever repeated.
  const visited = new Set<string>();
  for (;;) {
    const claim = `${base}.${snap.key}.claim`;
    if (visited.has(claim)) return false;
    visited.add(claim);
    if (tryCreate(claim, newToken(), cleanUp)) {
      try {
        const now = inspectLock(target);
        if (now && now.key === snap.key && ownerGone(now)) unlinkLock(target);
      } finally {
        unlinkLock(claim);
      }
      return true;
    }
    const held = inspectLock(claim);
    if (held === undefined) {
      // Retry at once only if the claim is really gone, not merely unreadable.
      return !statSync(claim, { throwIfNoEntry: false });
    }
    if (!ownerGone(held)) return false; // a live process is on it: wait
    target = claim;
    snap = held;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function isEntry(v: unknown): v is JournalEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.seq === 'number' &&
    typeof e.ts === 'string' &&
    typeof e.tool === 'string' &&
    Array.isArray(e.files) &&
    e.files.every(
      (f: unknown) =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as JournalFile).path === 'string' &&
        ((f as JournalFile).preHash === null || typeof (f as JournalFile).preHash === 'string') &&
        ((f as JournalFile).postHash === null || typeof (f as JournalFile).postHash === 'string'),
    )
  );
}

/**
 * Single-file convenience for the write tools: journal one pre/post pair
 * before the vault write. No-op when the journal is disabled.
 */
export async function journalWrite(
  ctx: { journal?: Journal },
  tool: string,
  path: string,
  pre: string | null,
  post: string | null,
): Promise<void> {
  if (!ctx.journal) return;
  const txn = ctx.journal.begin(tool);
  await txn.add(path, pre, post);
  await txn.commit();
}
