/**
 * Resolve a wikilink target string to a vault-relative note path.
 *
 * Uses Obsidian's loose resolution: exact match → add .md → basename match
 * → path-without-extension match. Returns undefined if no note matches.
 */
export function resolveLink(target: string, notes: Map<string, unknown>): string | undefined {
  if (notes.has(target)) return target;
  const withMd = `${target}.md`;
  if (notes.has(withMd)) return withMd;

  const targetLower = target.toLowerCase();
  const targetBase = (target.split('/').pop() ?? target).toLowerCase();

  for (const path of notes.keys()) {
    const pathNoExt = path.replace(/\.md$/i, '');
    if (pathNoExt.toLowerCase() === targetLower) return path;
    const pathBase = (pathNoExt.split('/').pop() ?? pathNoExt).toLowerCase();
    if (pathBase === targetBase) return path;
  }

  return undefined;
}
