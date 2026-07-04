import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { extractInlineTags, extractLinksWithLines, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { walkVault } from '@seekstone/core/walk';
import MiniSearch from 'minisearch';
import type { BacklinkRef } from '../context.js';
import { resolveLink } from './resolve.js';
import type { IndexedNote } from './types.js';

export type VaultIndex = MiniSearch<IndexedNote>;

export interface BuildResult {
  index: VaultIndex;
  notes: Map<string, IndexedNote>;
  backlinks: Map<string, BacklinkRef[]>;
  buildMs: number;
}

export async function buildIndex(vaultRoot: string): Promise<BuildResult> {
  const t0 = Date.now();

  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: {
      boost: { title: 3, tags: 2, body: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const entries = await walkVault(vaultRoot);
  const noteEntries = entries.filter((e) => e.kind === 'note');

  const docs: IndexedNote[] = [];
  const notes = new Map<string, IndexedNote>();

  await Promise.all(
    noteEntries.map(async (entry) => {
      try {
        const raw = await readFile(entry.absPath, 'utf8');
        const fm = parseFrontmatter(raw);
        const inlineTags = extractInlineTags(fm.body);
        const fmTags = frontmatterTags(fm.data);
        const allTags = [...new Set([...inlineTags, ...fmTags])];

        const title =
          typeof fm.data?.title === 'string' && fm.data.title
            ? fm.data.title
            : basename(entry.relPath, extname(entry.relPath));

        const doc: IndexedNote = {
          id: entry.relPath,
          title,
          body: fm.body,
          tags: allTags.join(' '),
          fmKeys: fm.keys.join(' '),
          fm: fm.data,
          raw,
          sizeBytes: entry.sizeBytes,
          mtimeMs: entry.mtimeMs,
        };
        docs.push(doc);
        notes.set(entry.relPath, doc);
      } catch {
        // Unreadable note — skip silently; index what we can.
      }
    }),
  );

  index.addAll(docs);

  const backlinks = buildBacklinks(notes);

  return { index, notes, backlinks, buildMs: Date.now() - t0 };
}

function buildBacklinks(notes: Map<string, IndexedNote>): Map<string, BacklinkRef[]> {
  const result = new Map<string, BacklinkRef[]>();
  for (const [srcPath, doc] of notes) {
    const seen = new Set<string>();
    for (const link of extractLinksWithLines(doc.raw)) {
      const resolved = resolveLink(link.target, notes);
      if (resolved === undefined) continue;
      // De-duplicate: one entry per (source, resolved-target) pair
      const dedupeKey = `${srcPath}\0${resolved}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      let arr = result.get(resolved);
      if (arr === undefined) {
        arr = [];
        result.set(resolved, arr);
      }
      arr.push({ path: srcPath, line: link.line, linkType: link.linkType });
    }
  }
  for (const arr of result.values()) {
    arr.sort((a, b) => a.path.localeCompare(b.path));
  }
  return result;
}
