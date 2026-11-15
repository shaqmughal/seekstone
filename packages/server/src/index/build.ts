import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { extractInlineTags, extractLinksWithLines, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { extractTasks } from '@seekstone/core/tasks';
import { type WalkOptions, walkVault } from '@seekstone/core/walk';
import MiniSearch from 'minisearch';
import type { BacklinkRef } from '../context.js';
import { buildResolveMaps, resolveLink } from './resolve.js';
import type { IndexedNote } from './types.js';

export type VaultIndex = MiniSearch<IndexedNote>;

export interface BuildResult {
  index: VaultIndex;
  notes: Map<string, IndexedNote>;
  backlinks: Map<string, BacklinkRef[]>;
  buildMs: number;
}

/**
 * Build the in-memory index. `scope` narrows the walk to the read scope
 * (SEEKSTONE_READ_PATHS): files outside it are never read, parsed or indexed,
 * so every index-backed tool is scoped by construction.
 */
export async function buildIndex(vaultRoot: string, scope?: WalkOptions): Promise<BuildResult> {
  const t0 = Date.now();

  const entries = await walkVault(vaultRoot, scope);
  const files: NoteFile[] = [];
  await Promise.all(
    entries
      .filter((e) => e.kind === 'note')
      .map(async (entry) => {
        try {
          const raw = await readFile(entry.absPath, 'utf8');
          files.push({
            relPath: entry.relPath,
            raw,
            sizeBytes: entry.sizeBytes,
            mtimeMs: entry.mtimeMs,
          });
        } catch {
          // Unreadable note — skip silently; index what we can.
        }
      }),
  );

  return { ...indexNotes(files), buildMs: Date.now() - t0 };
}

/** A note's bytes plus the walk metadata the index stores. */
export interface NoteFile {
  relPath: string;
  raw: string;
  sizeBytes: number;
  mtimeMs: number;
}

/**
 * The in-memory half of `buildIndex`: parse every note and build the search
 * index and backlinks. Notes are indexed in path order, so the same vault
 * always builds the same index, whatever order the file reads finished in
 * (SHA-532). Pure CPU work, which is what the CodSpeed bench measures.
 */
export function indexNotes(files: NoteFile[]): Omit<BuildResult, 'buildMs'> {
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

  const docs: IndexedNote[] = [];
  const notes = new Map<string, IndexedNote>();
  const sorted = [...files].sort((a, b) =>
    a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0,
  );
  for (const file of sorted) {
    try {
      const fm = parseFrontmatter(file.raw);
      const inlineTags = extractInlineTags(fm.body);
      const fmTags = frontmatterTags(fm.data);
      const allTags = [...new Set([...inlineTags, ...fmTags])];

      const title =
        typeof fm.data?.title === 'string' && fm.data.title
          ? fm.data.title
          : basename(file.relPath, extname(file.relPath));

      const doc: IndexedNote = {
        id: file.relPath,
        title,
        body: fm.body,
        tags: allTags.join(' '),
        fmKeys: fm.keys.join(' '),
        fm: fm.data,
        raw: file.raw,
        tasks: extractTasks(file.raw),
        sizeBytes: file.sizeBytes,
        mtimeMs: file.mtimeMs,
      };
      docs.push(doc);
      notes.set(file.relPath, doc);
    } catch {
      // Unparseable note — skip silently; index what we can.
    }
  }

  index.addAll(docs);

  return { index, notes, backlinks: buildBacklinks(notes) };
}

function buildBacklinks(notes: Map<string, IndexedNote>): Map<string, BacklinkRef[]> {
  const result = new Map<string, BacklinkRef[]>();
  const resolveMaps = buildResolveMaps(notes);
  for (const [srcPath, doc] of notes) {
    const seen = new Set<string>();
    for (const link of extractLinksWithLines(doc.raw)) {
      const resolved = resolveLink(link.target, notes, resolveMaps);
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
