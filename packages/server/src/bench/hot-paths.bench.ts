// Hot-path benchmarks for the CodSpeed speed gate (SHA-518).
//
// CodSpeed runs these under CPU simulation (instruction counting), so the
// numbers are stable enough to fail a PR on a regression even on shared CI
// runners. Locally, `npm run bench -w seekstone` falls back to plain Vitest
// timings. The vault is the committed 1k-note synthetic fixture (index build
// uses a fixed 100-note slice of it, see SLICE). Writes go to a scratch copy,
// never the fixture. Disk-bound costs (walking and reading files) are left to
// the weekly wall-clock run (SHA-519): simulation can't measure syscalls
// consistently, and gating on them made the check flap (SHA-532).

import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, test, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { restoreInboundRefs } from '../index/backlinks.js';
import { buildIndex, indexNotes, type NoteFile } from '../index/build.js';
import { buildResolveMaps, resolveLink } from '../index/resolve.js';
import { Journal } from '../journal.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { appendNote } from '../tools/append_note.js';
import { contextPack } from '../tools/context_pack.js';
import { getBacklinks } from '../tools/get_backlinks.js';
import { getLinks } from '../tools/get_links.js';
import { listTags } from '../tools/list_tags.js';
import { readNote } from '../tools/read_note.js';
import { resolveNote } from '../tools/resolve_note.js';
import { search } from '../tools/search.js';
import { vaultStats } from '../tools/vault_stats.js';

const FIXTURE = resolve(import.meta.dirname, '../../../harness/fixtures/vault-1k');
// The most-linked note in the fixture (269 inbound links).
const HUB = 'Encyclopedia/K/Kalinjar.md';
// A note with 30 wikilinks: get_links resolves each one (SHA-553).
const LINKY = 'MOCs/biography MOC.md';
// Seeds context_pack's neighborhood with LINKY (30 links) and, by fuzzy
// match, the geography MOC (21), so it resolves 51 outgoing links per call.
const PACK_QUERY = { query: 'biography', folder: 'MOCs', budgetBytes: 4096 };

// Under CodSpeed's CPU simulation everything runs far slower than native,
// including setup (copying 1k notes, building the index). Generous limits
// here, for this file only, keep Vitest's defaults from cutting runs short.
const SLOW = 15 * 60_000;
vi.setConfig({ testTimeout: SLOW, hookTimeout: SLOW });

// Index build runs on a fixed slice of the fixture: the full 1k-note build
// took ~11 minutes under simulation. The first SLICE notes by sorted path are
// the same every run, so per-note indexing cost is still compared like for like.
// The slice is read into memory once in setup; the bench times only indexNotes.
const SLICE = 100;

let vaultRoot: string;
let slice: NoteFile[];
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-bench-'));
  await cp(FIXTURE, vaultRoot, { recursive: true });
  const built = await buildIndex(vaultRoot);
  ctx = { ...built, vaultRoot, policy: PERMISSIVE_POLICY };
  ctx.journal = await Journal.open(vaultRoot, { maxBytes: 50e6, maxEntries: 1000 });

  const rels = ((await readdir(FIXTURE, { recursive: true })) as string[])
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.md') && !p.split('/').some((s) => s.startsWith('.')))
    .sort()
    .slice(0, SLICE);
  slice = await Promise.all(
    rels.map(async (relPath) => {
      const abs = join(FIXTURE, relPath);
      const raw = await readFile(abs, 'utf8');
      return {
        relPath,
        raw,
        sizeBytes: Buffer.byteLength(raw),
        mtimeMs: (await stat(abs)).mtimeMs,
      };
    }),
  );
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('index', () => {
  test('build', async ({ bench }) => {
    await bench(`indexNotes (${SLICE} notes, in memory)`, () => {
      indexNotes(slice);
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

// A deleted note coming back re-reads its linkers' links (SHA-572). The cost
// is per note, so it runs on the index-build slice to keep simulation time
// down. The target is the slice's most-linked note, so the scan parses its
// linkers and reconciles their other refs. The rebuilt bucket is the same
// each iteration.
describe('restore', () => {
  test('restoreInboundRefs', async ({ bench }) => {
    const { notes, backlinks } = indexNotes(slice);
    let path = '';
    for (const [target, refs] of backlinks)
      if (refs.length > (backlinks.get(path)?.length ?? 0)) path = target;
    if (path === '') throw new Error('no linked note in the bench slice');
    await bench(`restoreInboundRefs (${SLICE} notes)`, () => {
      restoreInboundRefs(backlinks, notes, path);
    }).run();
  });
});

// get_links, vault_stats and list_tags cache by index generation (SHA-461).
// The original rows bump the generation first, so they still time a call
// right after an index change; the "repeat" rows time a cache hit.

describe('outlinks', () => {
  test('get_links', async ({ bench }) => {
    await bench('get_links (30-link note)', () => {
      ctx.generation++;
      getLinks(ctx, { path: LINKY });
    }).run();
  });

  test('get_links repeat', async ({ bench }) => {
    await bench('get_links repeat (30-link note)', () => {
      getLinks(ctx, { path: LINKY });
    }).run();
  });
});

// context_pack and resolve_note use the same cached resolve maps (SHA-578).
// As above, the plain rows bump the generation; the "repeat" rows hit the cache.

describe('context', () => {
  test('context_pack', async ({ bench }) => {
    await bench('context_pack (2 MOC seeds)', () => {
      ctx.generation++;
      contextPack(ctx, PACK_QUERY);
    }).run();
  });

  test('context_pack repeat', async ({ bench }) => {
    await bench('context_pack repeat (2 MOC seeds)', () => {
      contextPack(ctx, PACK_QUERY);
    }).run();
  });
});

describe('resolve', () => {
  test('resolve_note', async ({ bench }) => {
    await bench('resolve_note (1k notes)', () => {
      ctx.generation++;
      resolveNote(ctx, { reference: 'Kalinjar' });
    }).run();
  });

  test('resolve_note repeat', async ({ bench }) => {
    await bench('resolve_note repeat (1k notes)', () => {
      resolveNote(ctx, { reference: 'Kalinjar' });
    }).run();
  });
});

describe('stats', () => {
  test('vault_stats', async ({ bench }) => {
    await bench('vault_stats (1k notes)', () => {
      ctx.generation++;
      vaultStats(ctx);
    }).run();
  });

  test('vault_stats repeat', async ({ bench }) => {
    await bench('vault_stats repeat (1k notes)', () => {
      vaultStats(ctx);
    }).run();
  });
});

describe('tags', () => {
  test('list_tags', async ({ bench }) => {
    await bench('list_tags (1k notes)', () => {
      ctx.generation++;
      listTags(ctx, { sort: 'count' });
    }).run();
  });

  test('list_tags repeat', async ({ bench }) => {
    await bench('list_tags repeat (1k notes)', () => {
      listTags(ctx, { sort: 'count' });
    }).run();
  });
});

describe('write', () => {
  test('append_note (journaled)', async ({ bench }) => {
    await bench('append_note with journal', async () => {
      await appendNote(ctx, { path: 'Home.md', content: 'bench line' });
    }).run();
  });
});
