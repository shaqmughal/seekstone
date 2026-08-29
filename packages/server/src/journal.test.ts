import { appendFile, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash } from './content-hash.js';
import { HISTORY_DIR, Journal, journalWrite, resolveJournalConfig } from './journal.js';

let vault: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-'));
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

const BIG = { maxBytes: 1e9, maxEntries: 1e6 };

describe('resolveJournalConfig', () => {
  it('defaults to 50 MB / 1000 entries', () => {
    expect(resolveJournalConfig({})).toEqual({ maxBytes: 50e6, maxEntries: 1000 });
  });
  it('SEEKSTONE_HISTORY=0|false|off disables', () => {
    for (const v of ['0', 'false', 'OFF', ' off ']) {
      expect(resolveJournalConfig({ SEEKSTONE_HISTORY: v })).toBeUndefined();
    }
    expect(resolveJournalConfig({ SEEKSTONE_HISTORY: '1' })).toBeDefined();
  });
  it('reads size and entry caps', () => {
    expect(
      resolveJournalConfig({
        SEEKSTONE_HISTORY_MAX_SIZE: '10mb',
        SEEKSTONE_HISTORY_MAX_ENTRIES: '5',
      }),
    ).toEqual({ maxBytes: 10e6, maxEntries: 5 });
    // Garbage falls back to defaults rather than disabling retention.
    expect(
      resolveJournalConfig({
        SEEKSTONE_HISTORY_MAX_SIZE: 'lots',
        SEEKSTONE_HISTORY_MAX_ENTRIES: '-1',
      }),
    ).toEqual({ maxBytes: 50e6, maxEntries: 1000 });
  });
});

describe('Journal', () => {
  it('stores pre-images content-addressed and lists newest first', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 'append_note', 'a.md', 'v1', 'v2');
    await journalWrite({ journal: j }, 'replace_in_note', 'a.md', 'v2', 'v3');
    await journalWrite({ journal: j }, 'create_note', 'b.md', null, 'new');

    const { writes, total } = j.list();
    expect(total).toBe(3);
    expect(writes.map((w) => w.seq)).toEqual([3, 2, 1]);
    expect(writes[0]).toMatchObject({ tool: 'create_note', paths: ['b.md'], undoable: true });
    expect(j.list({ path: 'a.md' }).total).toBe(2);
    expect(j.list({ limit: 1 }).writes).toHaveLength(1);

    const blobs = await readdir(join(vault, HISTORY_DIR, 'blobs'));
    expect(blobs.sort()).toEqual([contentHash('v1'), contentHash('v2')].sort());
    expect(await j.preimage(contentHash('v1'))).toBe('v1');
    expect(j.get(2)?.files[0]).toEqual({
      path: 'a.md',
      preHash: contentHash('v2'),
      postHash: contentHash('v3'),
    });
  });

  it('dedupes identical pre-images across entries', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 't', 'a.md', 'same', 'x');
    await journalWrite({ journal: j }, 't', 'b.md', 'same', 'y');
    expect(await readdir(join(vault, HISTORY_DIR, 'blobs'))).toHaveLength(1);
    expect(j.storedBytes).toBe(4);
  });

  it('persists across reopen with monotonic seq', async () => {
    const j1 = await Journal.open(vault, BIG);
    await journalWrite({ journal: j1 }, 't', 'a.md', 'v1', 'v2');
    await journalWrite({ journal: j1 }, 't', 'a.md', 'v2', 'v3');

    const j2 = await Journal.open(vault, BIG);
    expect(j2.list().total).toBe(2);
    expect(j2.latestUndoable()?.seq).toBe(2);
    await journalWrite({ journal: j2 }, 't', 'a.md', 'v3', 'v4');
    expect(j2.list().writes[0]?.seq).toBe(3);
    expect(j2.storedBytes).toBe(6);
  });

  it('survives a torn manifest line and ignores non-monotonic rows', async () => {
    const j1 = await Journal.open(vault, BIG);
    await journalWrite({ journal: j1 }, 't', 'a.md', 'v1', 'v2');
    const manifest = join(vault, HISTORY_DIR, 'manifest.jsonl');
    await appendFile(manifest, '{"seq":2,"ts":"x","tool":"t","fi', 'utf8'); // torn
    const warnings: string[] = [];
    const log = {
      level: 'debug' as const,
      error: () => {},
      warn: (m: string) => void warnings.push(m),
      info: () => {},
      debug: () => {},
    };
    const j2 = await Journal.open(vault, BIG, { log });
    expect(j2.list().total).toBe(1);
    expect(warnings.some((w) => w.includes('malformed'))).toBe(true);
    // The next commit continues from the last good seq.
    await journalWrite({ journal: j2 }, 't', 'a.md', 'v2', 'v3');
    expect(j2.list().writes[0]?.seq).toBe(2);
  });

  it('marks entries whose blobs were evicted by the byte cap as not undoable', async () => {
    const j = await Journal.open(vault, { maxBytes: 10, maxEntries: 1e6 });
    await journalWrite({ journal: j }, 't', 'a.md', '1234567', 'x'); // 7 bytes
    await journalWrite({ journal: j }, 't', 'b.md', 'abcdefg', 'y'); // 14 > 10 → evict seq 1
    const rows = j.list().writes;
    expect(rows.find((r) => r.seq === 1)?.undoable).toBe(false);
    expect(rows.find((r) => r.seq === 2)?.undoable).toBe(true);
    expect(j.latestUndoable()?.seq).toBe(2);
    expect(await readdir(join(vault, HISTORY_DIR, 'blobs'))).toEqual([contentHash('abcdefg')]);
    // The row itself is still listed — eviction is never silent.
    expect(j.list().total).toBe(2);
  });

  it('never evicts the entry just committed, even when it alone exceeds the cap', async () => {
    const j = await Journal.open(vault, { maxBytes: 3, maxEntries: 1e6 });
    await journalWrite({ journal: j }, 't', 'a.md', 'way more than three bytes', 'x');
    expect(j.list().writes[0]?.undoable).toBe(true);
  });

  it('keeps a shared blob alive while a newer entry still references it', async () => {
    const j = await Journal.open(vault, { maxBytes: 12, maxEntries: 1e6 });
    await journalWrite({ journal: j }, 't', 'a.md', 'shared!', 'x'); // 7
    await journalWrite({ journal: j }, 't', 'b.md', 'shared!', 'y'); // dedupe, still 7
    await journalWrite({ journal: j }, 't', 'c.md', 'other12', 'z'); // 14 > 12 → evict seq 1
    // seq 1's blob is also seq 2's blob — it must survive; the cap is then
    // still exceeded, so seq 2's ref goes next and the blob is finally freed.
    const rows = j.list().writes;
    expect(rows.find((r) => r.seq === 1)?.undoable).toBe(false);
    expect(rows.find((r) => r.seq === 2)?.undoable).toBe(false);
    expect(rows.find((r) => r.seq === 3)?.undoable).toBe(true);
    expect(j.storedBytes).toBe(7);
  });

  it('drops the oldest rows past the entry cap and compacts the manifest', async () => {
    const j = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 2 });
    for (let i = 1; i <= 4; i++)
      await journalWrite({ journal: j }, 't', 'a.md', `v${i}`, `v${i + 1}`);
    expect(j.list().writes.map((w) => w.seq)).toEqual([4, 3]);
    const lines = (await readFile(join(vault, HISTORY_DIR, 'manifest.jsonl'), 'utf8'))
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);
    expect(await readdir(join(vault, HISTORY_DIR, 'blobs'))).toHaveLength(2);
    // seq keeps counting after compaction.
    await journalWrite({ journal: j }, 't', 'a.md', 'v5', 'v6');
    expect(j.list().writes[0]?.seq).toBe(5);
  });

  it('refuses a corrupt blob rather than restoring wrong bytes', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 't', 'a.md', 'good', 'x');
    await writeFile(join(vault, HISTORY_DIR, 'blobs', contentHash('good')), 'evil', 'utf8');
    await expect(j.preimage(contentHash('good'))).rejects.toThrow(/corrupt/);
  });

  it('a transaction cannot be committed twice or added to after commit', async () => {
    const j = await Journal.open(vault, BIG);
    const txn = j.begin('t');
    await txn.add('a.md', 'v1', 'v2');
    await txn.commit();
    await expect(txn.commit()).rejects.toThrow(/double commit/);
    await expect(txn.add('b.md', null, 'x')).rejects.toThrow(/after commit/);
  });

  it('journalWrite is a no-op without a journal', async () => {
    await expect(journalWrite({}, 't', 'a.md', 'v1', 'v2')).resolves.toBeUndefined();
  });
});
