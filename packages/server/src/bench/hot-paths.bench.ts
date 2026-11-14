// Hot-path benchmarks for the CodSpeed speed gate (SHA-518).
//
// CodSpeed runs these under CPU simulation (instruction counting), so the
// numbers are stable enough to fail a PR on a regression even on shared CI
// runners. Locally, `npm run bench -w seekstone` falls back to plain Vitest
// timings. The vault is the committed 1k-note synthetic fixture: big enough
// to be realistic, small enough that simulation stays fast. Writes go to a
// scratch copy, never the fixture.

import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, test, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { buildResolveMaps, resolveLink } from '../index/resolve.js';
import { Journal } from '../journal.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from '../tools/append_note.js';
import { getBacklinks } from '../tools/get_backlinks.js';
import { readNote } from '../tools/read_note.js';
import { search } from '../tools/search.js';

const FIXTURE = resolve(import.meta.dirname, '../../../harness/fixtures/vault-1k');
// The most-linked note in the fixture (269 inbound links).
const HUB = 'Encyclopedia/K/Kalinjar.md';

// Under CodSpeed's CPU simulation everything runs far slower than native,
// including setup (copying 1k notes, building the index). Generous limits
// here, for this file only, keep Vitest's defaults from cutting runs short.
const SLOW = 15 * 60_000;
vi.setConfig({ testTimeout: SLOW, hookTimeout: SLOW });

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-bench-'));
  await cp(FIXTURE, vaultRoot, { recursive: true });
  const built = await buildIndex(vaultRoot);
  ctx = { ...built, vaultRoot, policy: PERMISSIVE_POLICY };
  ctx.journal = await Journal.open(vaultRoot, { maxBytes: 50e6, maxEntries: 1000 });
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('index', () => {
  test('build', async ({ bench }) => {
    await bench('buildIndex (1k notes)', async () => {
      await buildIndex(vaultRoot);
    }).run();
  });
});

describe('search', () => {
  test('lexical', async ({ bench }) => {
    await bench.compare(
      bench('common term', () => {
        search(ctx, { query: 'church', limit: 10 });
      }),
      bench('phrase', () => {
        search(ctx, { query: 'Roman Empire', limit: 10 });
      }),
      bench('rare term', () => {
        search(ctx, { query: 'phlogiston', limit: 10 });
      }),
    );
  });
});

describe('read', () => {
  test('read_note', async ({ bench }) => {
    await bench('read_note (hub note)', async () => {
      await readNote(ctx, { path: HUB });
    }).run();
  });
});

describe('links', () => {
  test('backlinks and resolution', async ({ bench }) => {
    const maps = buildResolveMaps(ctx.notes);
    await bench.compare(
      bench('get_backlinks (269 inbound)', () => {
        getBacklinks(ctx, { path: HUB });
      }),
      bench('buildResolveMaps (1k notes)', () => {
        buildResolveMaps(ctx.notes);
      }),
      bench('resolveLink', () => {
        resolveLink('Kalinjar', ctx.notes, maps);
      }),
    );
  });
});

describe('write', () => {
  test('append_note (journaled)', async ({ bench }) => {
    await bench('append_note with journal', async () => {
      await appendNote(ctx, { path: 'Home.md', content: 'bench line' });
    }).run();
  });
});
