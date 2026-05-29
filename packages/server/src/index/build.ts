import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { extractInlineTags, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { walkVault } from '@seekstone/core/walk';
import MiniSearch from 'minisearch';
import type { IndexedNote } from './types.js';

export type VaultIndex = MiniSearch<IndexedNote>;

export interface BuildResult {
  index: VaultIndex;
  notes: Map<string, IndexedNote>;
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

  return { index, notes, buildMs: Date.now() - t0 };
}
