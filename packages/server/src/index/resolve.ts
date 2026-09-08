/**
 * Resolve a wikilink target string to a vault-relative note path.
 *
 * Uses Obsidian's loose resolution: exact match → add .md → basename match
 * → path-without-extension match. Returns undefined if no note matches.
 *
 * Ambiguity (two notes sharing a basename, or case-variant paths) resolves to
 * the lexicographically smallest note path — deterministic regardless of how
 * the notes map was populated.
 */

export interface ResolveMaps {
  /** lowercased basename (no .md) → winning note path */
  byBasename: Map<string, string>;
  /** lowercased path without .md → winning note path */
  byPathNoExt: Map<string, string>;
}

/**
 * Precompute the loose-resolution lookup maps for a notes map. Build once per
 * batch (index build, watcher event) and pass to resolveLink so each loose
 * resolution is O(1) instead of a scan of every note.
 */
export function buildResolveMaps(notes: Map<string, unknown>): ResolveMaps {
  const byBasename = new Map<string, string>();
  const byPathNoExt = new Map<string, string>();
  for (const path of notes.keys()) {
    const pathNoExt = path.replace(/\.md$/i, '').toLowerCase();
    const base = pathNoExt.split('/').pop() ?? pathNoExt;
    const prevBase = byBasename.get(base);
    if (prevBase === undefined || path < prevBase) byBasename.set(base, path);
    const prevPath = byPathNoExt.get(pathNoExt);
    if (prevPath === undefined || path < prevPath) byPathNoExt.set(pathNoExt, path);
  }
  return { byBasename, byPathNoExt };
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
  return m.byBasename.get(targetBase) ?? m.byPathNoExt.get(targetLower);
}
