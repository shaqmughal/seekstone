import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { cachedResolveMaps } from '../index/generation.js';
import { buildResolveMaps, resolveCandidates, resolveLink } from '../index/resolve.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { contextPack } from './context_pack.js';
import { renameHeading } from './rename_heading.js';
import { resolveNote } from './resolve_note.js';

// Spy on the real resolver so a test can count resolve-map builds (SHA-578).
vi.mock('../index/resolve.js', { spy: true });

const HUB = `# Hub

Wombat migration notes. See [[alpha]], [[beta]], [[gamma#Old Section]] and [[nowhere]].
`;
const GAMMA = `# Gamma

Back to [[#Old Section]] and [[gamma#Old Section|self]].

## Old Section

Text.
`;
const LINKER = 'Points at [[gamma#Old Section]] and ![[gamma#Old Section]].\n';

let vaultRoot: string;
let ctx: ServerContext;

beforeEach(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-resolve-maps-'));
  await writeFile(join(vaultRoot, 'hub.md'), HUB, 'utf8');
  await writeFile(join(vaultRoot, 'alpha.md'), '# Alpha\n\nPlain.\n', 'utf8');
  await writeFile(join(vaultRoot, 'beta.md'), '# Beta\n\nPlain.\n', 'utf8');
  await writeFile(join(vaultRoot, 'gamma.md'), GAMMA, 'utf8');
  await writeFile(join(vaultRoot, 'linker.md'), LINKER, 'utf8');
  ctx = { ...(await buildIndex(vaultRoot)), vaultRoot, policy: PERMISSIVE_POLICY };
  vi.mocked(buildResolveMaps).mockClear();
  vi.mocked(resolveLink).mockClear();
  vi.mocked(resolveCandidates).mockClear();
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

/** Every call to `fn` got the cached maps as its third argument. */
function expectCachedMaps(fn: typeof resolveLink | typeof resolveCandidates, calls: number): void {
  const maps = cachedResolveMaps(ctx);
  expect(vi.mocked(fn).mock.calls).toHaveLength(calls);
  for (const call of vi.mocked(fn).mock.calls) expect(call[2]).toBe(maps);
}

describe('context_pack resolve maps', () => {
  it('builds the maps once per call and passes them to every resolveLink', () => {
    const pack = contextPack(ctx, { query: 'wombat migration', budgetBytes: 4096 });
    expect(pack.neighborhood.map((n) => n.path).sort()).toEqual([
      'alpha.md',
      'beta.md',
      'gamma.md',
    ]);
    expect(buildResolveMaps).toHaveBeenCalledTimes(1);
    expectCachedMaps(resolveLink, 4);
  });

  it('builds the maps zero times on a second call with no index change', () => {
    contextPack(ctx, { query: 'wombat migration', budgetBytes: 4096 });
    vi.mocked(buildResolveMaps).mockClear();
    vi.mocked(resolveLink).mockClear();
    contextPack(ctx, { query: 'wombat migration', budgetBytes: 4096 });
    expect(buildResolveMaps).not.toHaveBeenCalled();
    expectCachedMaps(resolveLink, 4);
  });
});

describe('resolve_note resolve maps', () => {
  it('builds the maps once per call and passes them to resolveCandidates', () => {
    expect(resolveNote(ctx, { reference: 'Alpha' }).matches).toEqual([
      { path: 'alpha.md', via: 'basename' },
    ]);
    expect(buildResolveMaps).toHaveBeenCalledTimes(1);
    expectCachedMaps(resolveCandidates, 1);
  });

  it('builds the maps zero times on a second call with no index change', () => {
    resolveNote(ctx, { reference: 'alpha' });
    vi.mocked(buildResolveMaps).mockClear();
    vi.mocked(resolveCandidates).mockClear();
    resolveNote(ctx, { reference: 'beta' });
    expect(buildResolveMaps).not.toHaveBeenCalled();
    expectCachedMaps(resolveCandidates, 1);
  });
});

describe('rename_heading resolve maps', () => {
  const rename = () =>
    renameHeading(ctx, { path: 'gamma.md', oldHeading: 'Old Section', newHeading: 'New Section' });

  // The tool resolves 4 heading links: the self link by name in gamma.md
  // ([[#Old Section]] needs no resolve), one in hub.md and two in linker.md.
  // Then the index refresh (removeNoteBacklinks, addNoteBacklinks) builds its
  // own maps, once each, as the note changes.
  const TOOL_RESOLVES = 4;
  const REFRESH_BUILDS = 2;

  it('builds the maps once to resolve, and resolves every heading link with them', async () => {
    const result = await rename();
    // gamma.md (2 self links), hub.md (1), linker.md (2)
    expect(result.linksRewritten).toBe(5);
    expect(buildResolveMaps).toHaveBeenCalledTimes(1 + REFRESH_BUILDS);
    const maps = vi.mocked(buildResolveMaps).mock.results[0]?.value;
    const calls = vi.mocked(resolveLink).mock.calls;
    expect(calls.filter((c) => c[2] === maps)).toHaveLength(TOOL_RESOLVES);
    // resolveLink rebuilds internally, out of the spy's sight, when it gets no maps.
    for (const call of calls) expect(call[2]).toBeDefined();
  });

  it('builds no maps to resolve when an earlier call left them cached', async () => {
    const maps = cachedResolveMaps(ctx);
    vi.mocked(buildResolveMaps).mockClear();
    await rename();
    expect(buildResolveMaps).toHaveBeenCalledTimes(REFRESH_BUILDS);
    const calls = vi.mocked(resolveLink).mock.calls;
    expect(calls.filter((c) => c[2] === maps)).toHaveLength(TOOL_RESOLVES);
    for (const call of calls) expect(call[2]).toBeDefined();
  });
});
