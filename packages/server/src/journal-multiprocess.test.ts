import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash } from './content-hash.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import {
  HISTORY_DIR,
  inspectLock,
  Journal,
  type JournalEntry,
  journalWrite,
  type LockSnapshot,
  removeIfUnchanged,
} from './journal.js';
import { createLogger } from './log.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { appendNote } from './tools/append_note.js';
import { undoWrite } from './tools/undo_write.js';

// SHA-559: two Journal instances stand in for two server processes on one vault.

let vault: string;
const BIG = { maxBytes: 1e9, maxEntries: 1e6 };
const hist = (...p: string[]) => join(vault, HISTORY_DIR, ...p);
const blob = (content: string) => hist('blobs', contentHash(content));
const write = (j: Journal, tool: string, pre: string | null, post: string) =>
  journalWrite({ journal: j }, tool, `${tool}.md`, pre, post);

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-mp-'));
});
afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

async function manifestSeqs(): Promise<number[]> {
  const raw = await readFile(hist('manifest.jsonl'), 'utf8');
  return raw
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l).seq);
}

describe('Journal shared by two processes', () => {
  it('alternating commits get unique, increasing seqs that a third instance sees', async () => {
    const a = await Journal.open(vault, BIG);
    const b = await Journal.open(vault, BIG);
    for (let i = 0; i < 3; i++) {
      await write(a, 'a', `a${i}`, `a${i + 1}`);
      await write(b, 'b', `b${i}`, `b${i + 1}`);
    }
    expect(await manifestSeqs()).toEqual([1, 2, 3, 4, 5, 6]);
    const rows = (await Journal.open(vault, BIG)).list().writes;
    expect(rows.map((w) => `${w.seq}${w.tool}`)).toEqual(['6b', '5a', '4b', '3a', '2b', '1a']);
    expect(rows.every((w) => w.undoable)).toBe(true);
  });

  it("list_writes and undo_write in one process see the other's write", async () => {
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const built = await buildIndex(vault);
    const ctxA = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    const ctxB = { ...ctxA, journal: await Journal.open(vault, BIG) };
    const journalA = await Journal.open(vault, BIG);
    await appendNote({ ...ctxA, journal: journalA }, { path: 'Note.md', content: 'from A' });

    const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });
    const listed = await dispatch(ctxB, 'list_writes', {}, log);
    expect(JSON.parse(listed.content[0]?.text ?? '').writes).toMatchObject([
      { seq: 1, tool: 'append_note', paths: ['Note.md'] },
    ]);

    // The usual conflict check applies to the other process's entry.
    const edited = await readFile(join(vault, 'Note.md'), 'utf8');
    await writeFile(join(vault, 'Note.md'), `${edited}hand edit\n`, 'utf8');
    await expect(undoWrite(ctxB, { seq: 1 })).rejects.toThrow(/undo_conflict/);
    await writeFile(join(vault, 'Note.md'), edited, 'utf8');

    expect((await undoWrite(ctxB, { seq: 1 })).undoSeq).toBe(2);
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe('start\n');
    expect(await journalA.refresh()).toBe(true);
    expect(journalA.list().writes[0]).toMatchObject({ seq: 2, undoOf: 1 });
  });

  it("eviction in one instance keeps the other's rows and blobs", async () => {
    const cap = { maxBytes: 1e9, maxEntries: 2 };
    const a = await Journal.open(vault, cap);
    const b = await Journal.open(vault, cap);
    await write(b, 'b', 'b1', 'b2');
    await write(b, 'b', 'b2', 'b3');
    await write(a, 'a', 'a1', 'a2');
    await write(a, 'a', 'a2', 'a3');
    await write(b, 'b', 'b3', 'b4'); // over the cap: B compacts the merged list
    expect(await manifestSeqs()).toEqual([4, 5]);
    expect((await Journal.open(vault, cap)).list().writes).toMatchObject([
      { seq: 5, tool: 'b', undoable: true },
      { seq: 4, tool: 'a', undoable: true },
    ]);
    await write(a, 'a', 'a3', 'a4');
    expect(await manifestSeqs()).toEqual([5, 6]);
    expect(a.list().writes.map((w) => w.seq)).toEqual([6, 5]);
  });

  it('re-stores a pre-image the other process evicted between add and commit', async () => {
    const small = { maxBytes: 10, maxEntries: 1e6 };
    const a = await Journal.open(vault, small);
    const b = await Journal.open(vault, small);
    await write(b, 'b', 'shared', 'x'); // seq 1, 6 bytes
    const txn = a.begin('a');
    await txn.add('a.md', 'shared', 'y'); // same blob, not committed yet
    await write(b, 'c', 'other12', 'z'); // 13 > 10 bytes: drops seq 1's blob
    await expect(readFile(blob('shared'))).rejects.toThrow(/ENOENT/);
    expect(a.isUndoable(await txn.commit())).toBe(true);
    expect(await a.preimage(contentHash('shared'))).toBe('shared');
  });

  // SHA-566: a refresh can read another process's manifest line before that
  // process removes the blobs it evicts, so the cache can claim a blob that
  // is gone. The commit must check the disk, not the cache.
  it('re-stores a cached pre-image that vanished with the manifest unchanged', async () => {
    const a = await Journal.open(vault, BIG);
    await write(a, 'a', 'shared', 'x'); // a now caches the blob
    expect(await a.refresh()).toBe(true); // reads its own first line; later loads are no-ops
    const txn = a.begin('a');
    await txn.add('a.md', 'shared', 'y');
    await rm(blob('shared')); // evicted elsewhere; no new manifest line
    expect(a.isUndoable(await txn.commit())).toBe(true);
    expect(await a.preimage(contentHash('shared'))).toBe('shared');
  });

  it('undo_write reports entry_evicted when the other process evicted the pre-image', async () => {
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const built = await buildIndex(vault);
    const small = { maxBytes: 20, maxEntries: 1e6 };
    const a = await Journal.open(vault, small);
    const ctxB = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    const b = await Journal.open(vault, small);
    await appendNote({ ...ctxB, journal: a }, { path: 'Note.md', content: 'from A' }); // seq 1
    await b.refresh(); // b caches seq 1's blob
    await write(a, 'big', 'more than twenty bytes!', 'x'); // a evicts seq 1's blob
    await expect(undoWrite({ ...ctxB, journal: b }, { seq: 1 })).rejects.toThrow(/entry_evicted/);
    expect(b.list().writes.find((w) => w.seq === 1)?.undoable).toBe(false);
  });

  it('undo_write maps a pre-image that vanished after the refresh to entry_evicted', async () => {
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const built = await buildIndex(vault);
    const ctx = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    const a = await Journal.open(vault, BIG);
    await appendNote({ ...ctx, journal: a }, { path: 'Note.md', content: 'from A' });
    const after = await readFile(join(vault, 'Note.md'), 'utf8');
    await a.refresh(); // nothing new after this, so the next refresh is a no-op
    await rm(blob('start\n')); // removed without a manifest change: the cache still lists it
    await expect(undoWrite({ ...ctx, journal: a }, { seq: 1 })).rejects.toThrow(/entry_evicted/);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(false);
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe(after);
  });

  // SHA-566: blob writes went through one fixed temp path per blob, so two
  // processes storing the same pre-image could rename or truncate each other's
  // temp file.
  it('two instances storing the same pre-image at once both succeed', async () => {
    const a = await Journal.open(vault, BIG);
    const b = await Journal.open(vault, BIG);
    for (let i = 0; i < 20; i++) {
      const pre = `shared ${i} ${'x'.repeat(50_000)}`;
      await Promise.all([a.begin('a').add('a.md', pre, 'y'), b.begin('b').add('b.md', pre, 'y')]);
      expect(await a.preimage(contentHash(pre))).toBe(pre);
    }
    // Only finished blobs are left: no temp files.
    expect((await readdir(hist('blobs'))).every((n) => /^[0-9a-f]{64}$/.test(n))).toBe(true);
  });

  it('counts a blob stored twice at once by one instance only once', async () => {
    const a = await Journal.open(vault, BIG);
    const pre = 'y'.repeat(10_000);
    await Promise.all([a.begin('a').add('a.md', pre, 'z'), a.begin('b').add('b.md', pre, 'z')]);
    expect(a.storedBytes).toBe(10_000);
  });

  it('a real second process committing alongside ends with 2N unique entries', async () => {
    const N = 40;
    const journalUrl = new URL('./journal.ts', import.meta.url).href;
    const script = `
      const { Journal, journalWrite } = await import(${JSON.stringify(journalUrl)});
      const j = await Journal.open(process.argv[1], { maxBytes: 1e9, maxEntries: 1e6 });
      process.stdout.write('ready\\n');
      for (let i = 0; i < ${N}; i++) await journalWrite({ journal: j }, 'child', 'c.md', 'c' + i, 'x');
    `;
    const args = ['--import', 'tsx', '--input-type=module', '-e', script, vault];
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    const exited = new Promise((res, rej) => child.on('error', rej).on('exit', res));
    await new Promise((res) => child.stdout.once('data', res));

    const j = await Journal.open(vault, BIG);
    for (let i = 0; i < N; i++) await write(j, 'parent', `p${i}`, 'x');
    expect(await exited).toBe(0);

    expect(await manifestSeqs()).toEqual(Array.from({ length: 2 * N }, (_, i) => i + 1));
    const rows = (await Journal.open(vault, BIG)).list({ limit: 1000 }).writes;
    expect(rows.filter((r) => r.tool === 'child')).toHaveLength(N);
    expect(rows.filter((r) => r.tool === 'parent')).toHaveLength(N);
  }, 30_000);
});

describe('Journal lock', () => {
  const dead = spawnSync(process.execPath, ['-e', '']).pid;
  const lock = () => hist('manifest.lock');
  const token = (o: object) => JSON.stringify({ host: hostname(), id: 'other', ...o });
  /** Write a lock file whose mtime is `ageMs` in the past. */
  async function plantLock(body: string, ageMs = 0): Promise<void> {
    await writeFile(lock(), body);
    if (ageMs > 0) {
      const t = new Date(Date.now() - ageMs);
      await utimes(lock(), t, t);
    }
  }
  /** Start a commit, check it is still waiting after a while, then free the lock. */
  async function expectWaits(j: Journal): Promise<void> {
    let done = false;
    const pending = write(j, 't', 'v1', 'v2').then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    expect(j.list().total).toBe(0);
    await rm(lock());
    await pending;
    expect(j.list().total).toBe(1);
  }

  it.each([
    ['its pid is dead', () => token({ pid: dead, ts: Date.now() }), 0],
    ['it is an older release whose pid is dead', () => JSON.stringify({ pid: dead, ts: 1 }), 0],
    ['it has no token and is older than 30 s', () => '', 31_000],
    [
      'another host holds it and it is older than 30 s',
      () => token({ pid: 1, host: 'elsewhere' }),
      31_000,
    ],
  ])('takes over a lock when %s', async (_, body, ageMs) => {
    const j = await Journal.open(vault, BIG);
    await plantLock(body(), ageMs);
    await write(j, 't', 'v1', 'v2');
    expect(j.list().total).toBe(1);
    await expect(readFile(lock())).rejects.toThrow(/ENOENT/);
    // Only the lock and the manifest's own files are left behind: no claims.
    expect((await readdir(hist())).sort()).toEqual(['blobs', 'manifest.jsonl']);
  });

  it.each([
    ['a live, fresh owner', () => token({ pid: process.pid, ts: Date.now() }), 0],
    // SHA-566: a live owner that pauses keeps its lock, however old.
    [
      'a live owner whose lock is older than 30 s',
      () => token({ pid: process.pid, ts: 1 }),
      31_000,
    ],
    [
      'an older release whose pid is alive',
      () => JSON.stringify({ pid: process.pid, ts: 1 }),
      31_000,
    ],
    ['an unreadable body with a fresh mtime', () => '', 0],
    ['another host, fresh', () => token({ pid: dead, host: 'elsewhere' }), 0],
  ])('waits for a lock held by %s, then commits', async (_, body, ageMs) => {
    const j = await Journal.open(vault, BIG);
    await plantLock(body(), ageMs);
    await expectWaits(j);
  });

  it('a waiter whose claim is taken leaves the dead lock to the claim holder', async () => {
    const j = await Journal.open(vault, BIG);
    await plantLock(token({ pid: dead }));
    // A live process is mid-way through removing it.
    const { key } = inspectLock(lock()) as { key: string };
    await writeFile(`${lock()}.${key}.claim`, token({ pid: process.pid }));
    let done = false;
    const pending = write(j, 't', 'v1', 'v2').then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    await rm(lock());
    await rm(`${lock()}.${key}.claim`);
    await pending;
    expect(j.list().total).toBe(1);
  });

  it('clears a claim whose holder died, then the dead lock it was for', async () => {
    const j = await Journal.open(vault, BIG);
    await plantLock(token({ pid: dead }));
    const { key } = inspectLock(lock()) as { key: string };
    await writeFile(`${lock()}.${key}.claim`, token({ pid: dead }));
    await write(j, 't', 'v1', 'v2');
    expect(j.list().total).toBe(1);
    expect((await readdir(hist())).sort()).toEqual(['blobs', 'manifest.jsonl']);
  });

  // SHA-566: two waiters judge the same dead lock. The first removes it and
  // takes the lock; the second must not then delete the first one's lock.
  it('a waiter never removes a lock that replaced the dead one it inspected', async () => {
    await Journal.open(vault, BIG);
    await plantLock(token({ pid: dead }));
    const seen = inspectLock(lock());
    expect(seen).toBeDefined();
    await rm(lock());
    const fresh = token({ pid: process.pid, id: 'winner' });
    await plantLock(fresh);
    expect(removeIfUnchanged(lock(), seen as LockSnapshot)).toBe(true);
    expect(await readFile(lock(), 'utf8')).toBe(fresh);
    expect((await readdir(hist())).sort()).toEqual(['blobs', 'manifest.lock']);
  });

  it('two in-process contenders on a dead lock commit one at a time', async () => {
    for (let round = 0; round < 10; round++) {
      const [a, b, c] = await Promise.all([1, 2, 3].map(() => Journal.open(vault, BIG)));
      // Make every commit read the manifest, so each critical section awaits I/O.
      await write(c as Journal, 'c', `c${round}`, 'x');
      await plantLock(token({ pid: dead }));
      await Promise.all([
        write(a as Journal, 'a', `a${round}`, 'x'),
        write(b as Journal, 'b', `b${round}`, 'x'),
      ]);
    }
    expect(await manifestSeqs()).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  // SHA-566 review: recovery used to stop after 4 nested claims, so a deeper
  // chain of abandoned claims blocked every write until someone deleted files.
  it('clears a chain of 6 abandoned claims, deepest first', async () => {
    const j = await Journal.open(vault, BIG);
    await plantLock(token({ pid: dead }));
    let target = lock();
    for (let i = 0; i < 6; i++) {
      const { key } = inspectLock(target) as LockSnapshot;
      target = `${lock()}.${key}.claim`;
      await writeFile(target, token({ pid: dead, id: `claim${i}` }));
    }
    await write(j, 't', 'v1', 'v2');
    expect(j.list().total).toBe(1);
    expect((await readdir(hist())).sort()).toEqual(['blobs', 'manifest.jsonl']);
  }, 15_000);

  it('clears a chain of 70 abandoned claims, past any fixed depth', async () => {
    const j = await Journal.open(vault, BIG);
    await plantLock(token({ pid: dead }));
    let target = lock();
    for (let i = 0; i < 70; i++) {
      const { key } = inspectLock(target) as LockSnapshot;
      target = `${lock()}.${key}.claim`;
      await writeFile(target, token({ pid: dead, id: `claim${i}` }));
    }
    await write(j, 't', 'v1', 'v2');
    expect(j.list().total).toBe(1);
    expect((await readdir(hist())).sort()).toEqual(['blobs', 'manifest.jsonl']);
  }, 15_000);

  it('fails the commit, not hangs, when the lock cannot be created at all', async () => {
    const j = await Journal.open(vault, BIG);
    await rm(hist(), { recursive: true });
    await expect(write(j, 't', null, 'x')).rejects.toThrow(/ENOENT/);
  });
});
