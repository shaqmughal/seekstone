import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash } from './content-hash.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { HISTORY_DIR, Journal, journalWrite } from './journal.js';
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
  it.each([
    ['its pid is dead', { pid: dead, ts: Date.now() }],
    ['it is older than 30 s', { pid: process.pid, ts: Date.now() - 31_000 }],
  ])('takes over a lock when %s', async (_, owner) => {
    const j = await Journal.open(vault, BIG);
    await writeFile(hist('manifest.lock'), JSON.stringify(owner));
    await write(j, 't', 'v1', 'v2');
    expect(j.list().total).toBe(1);
    await expect(readFile(hist('manifest.lock'))).rejects.toThrow(/ENOENT/);
  });

  it.each([
    ['a live, fresh owner', JSON.stringify({ pid: process.pid, ts: Date.now() })],
    ['an unreadable body with a fresh mtime', ''],
  ])('waits for a lock held by %s, then commits', async (_, body) => {
    const j = await Journal.open(vault, BIG);
    await writeFile(hist('manifest.lock'), body);
    let done = false;
    const pending = write(j, 't', 'v1', 'v2').then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(done).toBe(false);
    expect(j.list().total).toBe(0);
    await rm(hist('manifest.lock'));
    await pending;
    expect(j.list().total).toBe(1);
  });

  it('fails the commit, not hangs, when the lock cannot be created at all', async () => {
    const j = await Journal.open(vault, BIG);
    await rm(hist(), { recursive: true });
    await expect(write(j, 't', null, 'x')).rejects.toThrow(/ENOENT/);
  });
});
