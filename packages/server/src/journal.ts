import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { contentHash } from './content-hash.js';
import type { Logger } from './log.js';
import { parseSize } from './log.js';

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
 * Eviction drops the oldest entries' blobs; the entry stays listed with
 * `undoable: false` rather than vanishing silently. `SEEKSTONE_HISTORY=0`
 * disables the journal entirely (ctx.journal is undefined; tools skip it).
 *
 * Each MCP client runs its own server process, so several can share a vault.
 * Every manifest change holds `manifest.lock` (`open(..., 'wx')`) and first
 * reads what others appended, so seqs stay unique and eviction works from
 * the merged history. Reads (`refresh`) need no lock.
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

/** A lock older than this is taken over even when its owner pid looks alive. */
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 5;

/**
 * Read the journal settings from env. Returns undefined when the journal is
 * disabled (`SEEKSTONE_HISTORY=0|false`).
 */
export function resolveJournalConfig(
  env: Record<string, string | undefined>,
): JournalConfig | undefined {
  const flag = (env.SEEKSTONE_HISTORY ?? '').trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return undefined;
  const maxEntriesRaw = Number.parseInt(env.SEEKSTONE_HISTORY_MAX_ENTRIES ?? '', 10);
  return {
    maxBytes: parseSize(env.SEEKSTONE_HISTORY_MAX_SIZE, DEFAULT_MAX_BYTES),
    maxEntries:
      Number.isFinite(maxEntriesRaw) && maxEntriesRaw > 0 ? maxEntriesRaw : DEFAULT_MAX_ENTRIES,
  };
}

/** Write `content` to `dest` durably: temp file, fsync, rename over. */
async function writeDurable(dest: string, content: string): Promise<void> {
  const tmp = `${dest}.seekstone-tmp`;
  const fh = await open(tmp, 'w');
  try {
    await fh.writeFile(content, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, dest);
}

/** Append one line to `dest` durably (fsync before returning). */
async function appendDurable(dest: string, line: string): Promise<void> {
  const fh = await open(dest, 'a');
  try {
    await fh.writeFile(line, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
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
  private manifestIno = -1;
  private manifestOffset = 0;
  /** Bytes after the last newline: an append in flight, or torn by a crash. */
  private tailBytes = 0;
  /** Blob hash → byte size, for every blob currently on disk. */
  private readonly blobSizes: Map<string, number>;
  private totalBytes: number;
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
    await journal.refresh();
    // A torn last line from a crash: not listed; the next commit starts a new line.
    if (journal.tailBytes > 0) opts.log?.warn('journal: skipping malformed manifest line');
    return journal;
  }

  /** Read what other processes appended or compacted since we last looked. True if anything. */
  refresh(): Promise<boolean> {
    return this.enqueue(() => this.load());
  }

  /** One stat when nothing changed. Only whole lines are read. */
  private async load(): Promise<boolean> {
    try {
      const st = await stat(this.manifestPath);
      if (st.ino === this.manifestIno && st.size === this.manifestOffset + this.tailBytes) {
        return false;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
    const fh = await open(this.manifestPath, 'r');
    let buf: Buffer;
    let start: number;
    try {
      const st = await fh.stat();
      const replaced = st.ino !== this.manifestIno || st.size < this.manifestOffset;
      start = replaced ? 0 : this.manifestOffset;
      buf = Buffer.alloc(st.size - start);
      buf = buf.subarray(0, (await fh.read(buf, 0, buf.length, start)).bytesRead);
      if (replaced) {
        this.entries = [];
        this.manifestIno = st.ino;
      }
    } finally {
      await fh.close();
    }
    const end = buf.lastIndexOf(0x0a) + 1;
    this.manifestOffset = start + end;
    this.tailBytes = buf.length - end;
    await this.ingest(buf.subarray(0, end).toString('utf8'), start === 0);
    return true;
  }

  /** Parse complete manifest lines and add their entries (and their blobs' sizes). */
  private async ingest(text: string, fromStart: boolean): Promise<void> {
    let lastSeq = fromStart ? 0 : this.nextSeq - 1;
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // Never fail boot over a damaged line; the write it described is not listed.
        this.log?.warn('journal: skipping malformed manifest line');
        continue;
      }
      if (!isEntry(parsed) || parsed.seq <= lastSeq) {
        this.log?.warn('journal: skipping invalid manifest entry');
        continue;
      }
      this.entries.push(parsed);
      lastSeq = parsed.seq;
      for (const f of parsed.files) {
        if (f.preHash === null || this.blobSizes.has(f.preHash)) continue;
        try {
          const size = (await stat(join(this.blobDir, f.preHash))).size;
          this.blobSizes.set(f.preHash, size);
          this.totalBytes += size;
        } catch {
          /* already evicted — the entry lists as not undoable */
        }
      }
    }
    this.nextSeq = Math.max(this.nextSeq, lastSeq + 1);
  }

  begin(tool: string, undoOf?: number): JournalTxn {
    const files: JournalFile[] = [];
    const preimages = new Map<string, string>();
    let committed = false;
    return {
      add: async (path, pre, post) => {
        if (committed) throw new Error('journal: add after commit');
        const preHash = pre === null ? null : await this.storeBlob(pre);
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
    const filtered =
      path === undefined && visible === undefined
        ? this.entries
        : this.entries.filter(
            (e) =>
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

  /** Read a stored pre-image by hash. Throws if evicted. */
  async preimage(hash: string): Promise<string> {
    const raw = await readFile(join(this.blobDir, hash), 'utf8');
    // Integrity check on the stored blob (not a secret comparison); the
    // constant-time compare is free and keeps static analysis quiet.
    const actual = Buffer.from(contentHash(raw), 'hex');
    const expected = Buffer.from(hash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error(`journal: blob ${hash} is corrupt (hash mismatch)`);
    }
    return raw;
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

  private async storeBlob(content: string): Promise<string> {
    const hash = contentHash(content);
    if (this.blobSizes.has(hash)) return hash;
    await writeDurable(join(this.blobDir, hash), content);
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
    const othersWrote = await this.load();
    // A blob stored before the lock may have been evicted since (shared with
    // an old entry). Others only evict while committing, which we'd have seen.
    for (const [hash, content] of preimages) {
      if (!othersWrote && this.blobSizes.has(hash)) continue;
      try {
        await stat(join(this.blobDir, hash));
      } catch {
        this.totalBytes -= this.blobSizes.get(hash) ?? 0;
        this.blobSizes.delete(hash);
        await this.storeBlob(content);
      }
    }
    const entry: JournalEntry = { seq: this.nextSeq, ts: new Date().toISOString(), tool, files };
    if (undoOf !== undefined) entry.undoOf = undoOf;
    // After a torn line, start a fresh one so this entry parses.
    const line = `${this.tailBytes > 0 ? '\n' : ''}${JSON.stringify(entry)}\n`;
    await appendDurable(this.manifestPath, line);
    this.manifestOffset += this.tailBytes + Buffer.byteLength(line, 'utf8');
    this.tailBytes = 0;
    this.nextSeq++;
    this.entries.push(entry);
    await this.evict();
    return entry;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const id = randomBytes(6).toString('hex');
    const token = JSON.stringify({ pid: process.pid, ts: Date.now(), id });
    const deadline = Date.now() + 2 * LOCK_STALE_MS;
    for (;;) {
      try {
        const fh = await open(this.lockPath, 'wx');
        try {
          await fh.writeFile(token, 'utf8');
        } finally {
          await fh.close();
        }
        break;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        // Windows reports EPERM while another process is deleting the lock.
        if (code !== 'EEXIST' && !(code === 'EPERM' && process.platform === 'win32')) throw err;
      }
      if (await lockIsStale(this.lockPath)) {
        this.log?.warn('journal: taking over a stale lock');
        await rm(this.lockPath, { force: true });
      } else if (Date.now() > deadline) {
        throw new Error('journal: timed out waiting for the history lock');
      } else {
        await sleep(LOCK_RETRY_MS);
      }
    }
    const acquired = Date.now();
    try {
      return await fn();
    } finally {
      // A live owner's lock can only be taken over once LOCK_STALE_MS old.
      const ours =
        Date.now() - acquired < LOCK_STALE_MS ||
        (await readFile(this.lockPath, 'utf8').catch(() => '')) === token;
      if (ours) await rm(this.lockPath, { force: true });
    }
  }

  /**
   * Enforce the caps. Blobs are reference-counted across entries, so a
   * pre-image shared by an old and a new entry survives the old one's
   * eviction. Over the entry cap, the oldest rows are dropped and the
   * manifest rewritten atomically; over the byte cap, the oldest entries'
   * blobs are removed but the rows stay (listed as undoable: false).
   */
  private async evict(): Promise<void> {
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
    while (this.entries.length > this.config.maxEntries) {
      const oldest = this.entries.shift() as JournalEntry;
      await dropBlobs(oldest);
      rewrite = true;
    }
    // Never evict the entry just committed — a write must be undoable at
    // least until the next one lands, whatever the cap.
    for (let i = 0; this.totalBytes > this.config.maxBytes && i < this.entries.length - 1; i++) {
      await dropBlobs(this.entries[i] as JournalEntry);
    }
    if (rewrite) {
      await writeDurable(
        this.manifestPath,
        this.entries.map((e) => `${JSON.stringify(e)}\n`).join(''),
      );
      const st = await stat(this.manifestPath);
      this.manifestIno = st.ino;
      this.manifestOffset = st.size;
      this.log?.debug('journal: manifest compacted', { entries: this.entries.length });
    }
  }
}

/** Stale = older than LOCK_STALE_MS (by mtime if the body is unreadable) or owner pid gone. */
async function lockIsStale(lockPath: string): Promise<boolean> {
  let raw: string;
  let mtimeMs: number;
  try {
    raw = await readFile(lockPath, 'utf8');
    mtimeMs = (await stat(lockPath)).mtimeMs;
  } catch {
    return false; // gone already: the caller retries
  }
  let owner: { pid?: unknown; ts?: unknown } = {};
  try {
    owner = JSON.parse(raw);
  } catch {
    /* unparsable body: fall back to mtime, pid unknown */
  }
  const since = typeof owner.ts === 'number' ? owner.ts : mtimeMs;
  if (Date.now() - since > LOCK_STALE_MS) return true;
  return typeof owner.pid === 'number' && !pidAlive(owner.pid);
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
