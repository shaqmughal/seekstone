import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import {
  appendPeriodicNote,
  formatMomentDate,
  getPeriodicNote,
  resolveNotePath,
} from './periodic_note.js';

let tmpDir: string;

function freshCtx(): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot: tmpDir, index, notes: new Map(), backlinks: new Map() };
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-periodic-note-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ── formatMomentDate ──────────────────────────────────────────────────────────

describe('formatMomentDate', () => {
  const d = new Date('2026-06-09'); // Tuesday, ISO week 24

  it('formats YYYY-MM-DD', () => {
    expect(formatMomentDate(d, 'YYYY-MM-DD')).toBe('2026-06-09');
  });

  it('formats YY-MM-DD', () => {
    expect(formatMomentDate(d, 'YY-MM-DD')).toBe('26-06-09');
  });

  it('formats YYYY/MM/DD', () => {
    expect(formatMomentDate(d, 'YYYY/MM/DD')).toBe('2026/06/09');
  });

  it('formats D MMMM — single-digit day, literal month name preserved via []', () => {
    expect(formatMomentDate(d, 'D [June] YYYY')).toBe('9 June 2026');
  });

  it('formats monthly YYYY-MM', () => {
    expect(formatMomentDate(d, 'YYYY-MM')).toBe('2026-06');
  });

  it('formats quarterly YYYY-[Q]Q', () => {
    expect(formatMomentDate(d, 'YYYY-[Q]Q')).toBe('2026-Q2');
  });

  it('formats yearly YYYY', () => {
    expect(formatMomentDate(d, 'YYYY')).toBe('2026');
  });

  it('formats weekly gggg-[W]ww', () => {
    expect(formatMomentDate(d, 'gggg-[W]ww')).toBe('2026-W24');
  });

  it('handles ISO week year boundary — 2019-12-30 is week 01 of 2020', () => {
    const boundary = new Date('2019-12-30');
    expect(formatMomentDate(boundary, 'gggg-[W]ww')).toBe('2020-W01');
  });

  it('preserves multiple literals', () => {
    expect(formatMomentDate(d, '[Week] ww [of] YYYY')).toBe('Week 24 of 2026');
  });
});

// ── resolveNotePath ───────────────────────────────────────────────────────────

describe('resolveNotePath', () => {
  it('places note in configured folder', () => {
    const cfg = { folder: 'Journal', format: 'YYYY-MM-DD', template: '' };
    expect(resolveNotePath(cfg, new Date('2026-06-09'))).toBe('Journal/2026-06-09.md');
  });

  it('places note at vault root when folder is empty', () => {
    const cfg = { folder: '', format: 'YYYY-MM-DD', template: '' };
    expect(resolveNotePath(cfg, new Date('2026-06-09'))).toBe('2026-06-09.md');
  });

  it('handles nested folder', () => {
    const cfg = { folder: 'Notes/Daily', format: 'YYYY-MM-DD', template: '' };
    expect(resolveNotePath(cfg, new Date('2026-01-01'))).toBe('Notes/Daily/2026-01-01.md');
  });
});

// ── getPeriodicNote ───────────────────────────────────────────────────────────

describe('getPeriodicNote', () => {
  it('reports note as missing without creating when createIfMissing is false', async () => {
    const ctx = freshCtx();
    const result = await getPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-01-01',
      createIfMissing: false,
    });
    expect(result.existed).toBe(false);
    expect(result.created).toBe(false);
    expect(result.path).toBe('2026-01-01.md'); // default folder + format
  });

  it('creates the note when createIfMissing is true', async () => {
    const ctx = freshCtx();
    const result = await getPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-01-02',
      createIfMissing: true,
    });
    expect(result.created).toBe(true);
    expect(result.existed).toBe(false);
    const disk = await readFile(join(tmpDir, result.path), 'utf8');
    expect(disk).toBe('');
  });

  it('reports note as existed when it already exists', async () => {
    const ctx = freshCtx();
    await writeFile(join(tmpDir, '2026-01-03.md'), '# Existing note', 'utf8');
    const result = await getPeriodicNote(ctx, { period: 'daily', date: '2026-01-03' });
    expect(result.existed).toBe(true);
    expect(result.created).toBe(false);
  });

  it('reads config from .obsidian/daily-notes.json', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-cfg-daily-'));
    const ctx2 = { vaultRoot, index: freshCtx().index, notes: new Map(), backlinks: new Map() };
    try {
      await mkdir(join(vaultRoot, '.obsidian'), { recursive: true });
      await writeFile(
        join(vaultRoot, '.obsidian', 'daily-notes.json'),
        JSON.stringify({ folder: 'Journal', format: 'YYYY-MM-DD' }),
        'utf8',
      );
      const result = await getPeriodicNote(ctx2, {
        period: 'daily',
        date: '2026-05-29',
        createIfMissing: false,
      });
      expect(result.path).toBe('Journal/2026-05-29.md');
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('creates from template when template is configured', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-cfg-template-'));
    const ctx2 = { vaultRoot, index: freshCtx().index, notes: new Map(), backlinks: new Map() };
    try {
      await mkdir(join(vaultRoot, '.obsidian'), { recursive: true });
      await mkdir(join(vaultRoot, 'Templates'), { recursive: true });
      await writeFile(join(vaultRoot, 'Templates', 'daily.md'), '# Daily Note\n', 'utf8');
      await writeFile(
        join(vaultRoot, '.obsidian', 'daily-notes.json'),
        JSON.stringify({ folder: '', format: 'YYYY-MM-DD', template: 'Templates/daily' }),
        'utf8',
      );
      const result = await getPeriodicNote(ctx2, {
        period: 'daily',
        date: '2026-01-10',
        createIfMissing: true,
      });
      expect(result.created).toBe(true);
      const disk = await readFile(join(vaultRoot, result.path), 'utf8');
      expect(disk).toBe('# Daily Note\n');
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('resolves weekly path from periodic-notes plugin config', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-cfg-weekly-'));
    const ctx2 = { vaultRoot, index: freshCtx().index, notes: new Map(), backlinks: new Map() };
    try {
      await mkdir(join(vaultRoot, '.obsidian', 'plugins', 'periodic-notes'), { recursive: true });
      await writeFile(
        join(vaultRoot, '.obsidian', 'plugins', 'periodic-notes', 'data.json'),
        JSON.stringify({ weekly: { folder: 'Weekly', format: 'gggg-[W]ww' } }),
        'utf8',
      );
      const result = await getPeriodicNote(ctx2, {
        period: 'weekly',
        date: '2026-06-09',
        createIfMissing: false,
      });
      expect(result.path).toBe('Weekly/2026-W24.md');
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('uses default format when no config file exists', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-no-config-'));
    const ctx2 = { vaultRoot, index: freshCtx().index, notes: new Map(), backlinks: new Map() };
    try {
      const result = await getPeriodicNote(ctx2, {
        period: 'monthly',
        date: '2026-06-09',
        createIfMissing: false,
      });
      expect(result.path).toBe('2026-06.md');
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it('rejects a path outside the vault (folder config with ..)', async () => {
    const vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-traversal-'));
    const ctx2 = { vaultRoot, index: freshCtx().index, notes: new Map(), backlinks: new Map() };
    try {
      await mkdir(join(vaultRoot, '.obsidian'), { recursive: true });
      await writeFile(
        join(vaultRoot, '.obsidian', 'daily-notes.json'),
        JSON.stringify({ folder: '../../etc', format: 'YYYY-MM-DD' }),
        'utf8',
      );
      await expect(
        getPeriodicNote(ctx2, { period: 'daily', date: '2026-01-01', createIfMissing: false }),
      ).rejects.toThrow('Path outside vault');
    } finally {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });
});

// ── appendPeriodicNote ────────────────────────────────────────────────────────

describe('appendPeriodicNote', () => {
  it('creates and appends to a missing note when createIfMissing is true', async () => {
    const ctx = freshCtx();
    const result = await appendPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-02-01',
      content: 'First entry.',
      createIfMissing: true,
    });
    expect(result.path).toBe('2026-02-01.md');
    const disk = await readFile(join(tmpDir, result.path), 'utf8');
    expect(disk).toBe('First entry.');
  });

  it('appends to an existing note preserving frontmatter', async () => {
    const ctx = freshCtx();
    const initial = '---\ntags: [daily]\n---\n\nMorning notes.';
    await writeFile(join(tmpDir, '2026-02-02.md'), initial, 'utf8');
    const result = await appendPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-02-02',
      content: 'Evening entry.',
    });
    const disk = await readFile(join(tmpDir, result.path), 'utf8');
    expect(disk).toContain('---\ntags: [daily]\n---');
    expect(disk).toContain('Morning notes.');
    expect(disk).toContain('Evening entry.');
  });

  it('throws when note is missing and createIfMissing is false', async () => {
    const ctx = freshCtx();
    await expect(
      appendPeriodicNote(ctx, {
        period: 'daily',
        date: '2026-03-01',
        content: 'x',
        createIfMissing: false,
      }),
    ).rejects.toThrow('not found');
  });

  it('returns bytesWritten matching actual file size', async () => {
    const ctx = freshCtx();
    await writeFile(join(tmpDir, '2026-02-03.md'), 'Existing content.', 'utf8');
    const result = await appendPeriodicNote(ctx, {
      period: 'daily',
      date: '2026-02-03',
      content: 'New line.',
    });
    const disk = await readFile(join(tmpDir, result.path));
    expect(result.bytesWritten).toBe(disk.byteLength);
  });
});
