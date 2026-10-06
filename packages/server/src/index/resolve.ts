/**
 * Resolve a wikilink target string to a vault-relative note path.
 *
 * Uses Obsidian's loose resolution: exact match → add .md → basename match
 * → path-without-extension match → frontmatter alias match. Returns undefined
 * if no note matches.
 *
 * Ambiguity (two notes sharing a basename or alias, or case-variant paths)
 * resolves to the lexicographically smallest note path — deterministic
 * regardless of how the notes map was populated.
 */

import { frontmatterAliases } from '@seekstone/core/extract';

export type ResolveVia = 'path' | 'basename' | 'relpath' | 'alias';

export interface ResolveCandidate {
  path: string;
  via: ResolveVia;
  /** Present only when via === 'alias': the alias exactly as written in frontmatter. */
  alias?: string;
}

export interface ResolveMaps {
  /** lowercased basename (no .md) → note paths, sorted ascending */
  byBasename: Map<string, string[]>;
  /** lowercased path without .md → note paths, sorted ascending */
  byPathNoExt: Map<string, string[]>;
  /** lowercased frontmatter alias → owning notes, sorted by path ascending */
  byAlias: Map<string, { path: string; alias: string }[]>;
}

/**
 * Precompute the loose-resolution lookup maps for a notes map. Build once per
 * batch (index build, watcher event) and pass to resolveLink so each loose
 * resolution is O(1) instead of a scan of every note.
 *
 * Aliases come from each note's parsed frontmatter (`fm`), so maps built from
 * fm-less note values (bare `{}` or `{raw}` stubs) simply have no alias tier.
 * Known staleness: the watcher re-resolves only the changed note's outlinks,
 * so editing note A's aliases doesn't re-resolve links already indexed from
 * note B — the same class as basename shadowing on create; a cold rebuild
 * fixes both.
 */
export function buildResolveMaps(notes: Map<string, unknown>): ResolveMaps {
  const byBasename = new Map<string, string[]>();
  const byPathNoExt = new Map<string, string[]>();
  const byAlias = new Map<string, { path: string; alias: string }[]>();
  for (const [path, note] of notes) {
    const pathNoExt = path.replace(/\.md$/i, '').toLowerCase();
    const base = pathNoExt.split('/').pop() ?? pathNoExt;
    push(byBasename, base, path);
    push(byPathNoExt, pathNoExt, path);
    const fm = (note as { fm?: Record<string, unknown> | null } | null)?.fm ?? null;
    for (const alias of frontmatterAliases(fm)) {
      push(byAlias, alias.toLowerCase(), { path, alias });
    }
  }
  for (const list of byBasename.values()) list.sort();
  for (const list of byPathNoExt.values()) list.sort();
  for (const list of byAlias.values()) list.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { byBasename, byPathNoExt, byAlias };
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function resolveLink(
  target: string,
  notes: Map<string, unknown>,
  maps?: ResolveMaps,
): string | undefined {
  if (notes.has(target)) return target;
  const withMd = `${target}.md`;
  if (notes.has(withMd)) return withMd;

  const m = maps ?? buildResolveMaps(notes);
  const targetLower = target.toLowerCase();
  const targetBase = targetLower.split('/').pop() ?? targetLower;
  return (
    m.byBasename.get(targetBase)?.[0] ??
    m.byPathNoExt.get(targetLower)?.[0] ??
    m.byAlias.get(targetLower)?.[0]?.path
  );
}

/**
 * Every note a target could refer to, in tier order (exact path → basename →
 * path-without-extension → alias) then lexicographic order within a tier,
 * deduplicated by path keeping the highest tier. The first candidate is
 * always exactly what resolveLink returns for the same input.
 */
export function resolveCandidates(
  target: string,
  notes: Map<string, unknown>,
  maps?: ResolveMaps,
): ResolveCandidate[] {
  const out: ResolveCandidate[] = [];
  const seen = new Set<string>();
  const add = (candidate: ResolveCandidate): void => {
    if (seen.has(candidate.path)) return;
    seen.add(candidate.path);
    out.push(candidate);
  };

  if (notes.has(target)) add({ path: target, via: 'path' });
  const withMd = `${target}.md`;
  if (notes.has(withMd)) add({ path: withMd, via: 'path' });

  const m = maps ?? buildResolveMaps(notes);
  const targetLower = target.toLowerCase();
  const targetBase = targetLower.split('/').pop() ?? targetLower;
  for (const path of m.byBasename.get(targetBase) ?? []) add({ path, via: 'basename' });
  for (const path of m.byPathNoExt.get(targetLower) ?? []) add({ path, via: 'relpath' });
  for (const { path, alias } of m.byAlias.get(targetLower) ?? [])
    add({ path, via: 'alias', alias });
  return out;
}
