import { readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { walkVault } from '@seekstone/core/walk';

export interface Candidate {
  relPath: string;
  absPath: string;
  fmKeys: string[];
}

/**
 * Pick frontmatter-heavy notes for the write-safety sample.
 *
 * "Heavy" = has frontmatter, isn't malformed, has at least `minKeys` keys.
 * We then take a deterministic stride through the list so re-runs against
 * the same snapshot pick the same notes — reproducibility for the article.
 */
export async function selectFrontmatterHeavyNotes(
  vaultRoot: string,
  opts: { sample: number; minKeys?: number } = { sample: 25 },
): Promise<Candidate[]> {
  const minKeys = opts.minKeys ?? 3;
  const entries = await walkVault(vaultRoot);
  const candidates: Candidate[] = [];
  for (const e of entries) {
    if (e.kind !== 'note') continue;
    const text = await readFile(e.absPath, 'utf8');
    const fm = parseFrontmatter(text);
    if (!fm.present || fm.malformed) continue;
    if (fm.keys.length < minKeys) continue;
    candidates.push({ relPath: e.relPath, absPath: e.absPath, fmKeys: fm.keys });
  }
  // Deterministic stride: sort by relPath, then sample every Nth so the
  // chosen set is stable for a given snapshot.
  candidates.sort((a, b) => a.relPath.localeCompare(b.relPath));
  if (candidates.length <= opts.sample) return candidates;
  const stride = Math.floor(candidates.length / opts.sample);
  const picked: Candidate[] = [];
  for (let i = 0; i < candidates.length && picked.length < opts.sample; i += stride) {
    const c = candidates[i];
    if (c) picked.push(c);
  }
  return picked;
}
