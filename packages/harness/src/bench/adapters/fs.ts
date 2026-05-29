import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import MiniSearch from 'minisearch';
import { parseFrontmatter } from '../../profiler/frontmatter.js';
import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';

interface IndexedDoc {
  id: string;
  title: string;
  body: string;
  tags: string;
  fmKeys: string;
}

export interface FsAdapterOptions {
  /** Absolute path to the vault root the adapter will read from and write to. */
  vaultRoot: string;
}

/**
 * Filesystem-direct backend. Mirrors the seekstone MCP server: MiniSearch
 * in-process, no HTTP round-trip, excerpts (~200 chars) returned from search
 * rather than full note content.
 *
 * Build is async because it walks the vault and builds the full-text index
 * before the first query. Use `FsAdapter.build(opts)` — not `new`.
 */
export class FsAdapter implements Backend {
  readonly name = 'fs';
  readonly description = 'Filesystem-direct (MiniSearch in-process, no HTTP round-trip)';

  private readonly vaultRoot: string;
  private readonly index: MiniSearch<IndexedDoc>;
  private readonly noteMap: Map<string, string>;

  private constructor(
    vaultRoot: string,
    index: MiniSearch<IndexedDoc>,
    noteMap: Map<string, string>,
  ) {
    this.vaultRoot = vaultRoot;
    this.index = index;
    this.noteMap = noteMap;
  }

  static async build(opts: FsAdapterOptions): Promise<FsAdapter> {
    const { vaultRoot } = opts;
    const index = new MiniSearch<IndexedDoc>({
      fields: ['title', 'body', 'tags', 'fmKeys'],
      storeFields: ['title', 'tags'],
      searchOptions: {
        boost: { title: 3, tags: 2, fmKeys: 1.5 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    const relPaths = await fg('**/*.md', {
      cwd: vaultRoot,
      ignore: ['.obsidian/**', '.trash/**', '.git/**'],
    });

    const noteMap = new Map<string, string>();
    const docs: IndexedDoc[] = [];

    await Promise.all(
      relPaths.map(async (relPath) => {
        try {
          const raw = await readFile(join(vaultRoot, relPath), 'utf8');
          const fm = parseFrontmatter(raw);
          const title = relPath.replace(/\.md$/, '').split('/').at(-1) ?? relPath;
          const tags = extractTagValues(fm.data);
          noteMap.set(relPath, raw);
          docs.push({ id: relPath, title, body: fm.body, tags, fmKeys: fm.keys.join(' ') });
        } catch {
          // skip unreadable files
        }
      }),
    );

    index.addAll(docs);
    return new FsAdapter(vaultRoot, index, noteMap);
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const rawHits = this.index.search(query).slice(0, 10);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const hits: SearchHit[] = rawHits.map((r) => {
      const raw = this.noteMap.get(r.id) ?? '';
      const fm = parseFrontmatter(raw);
      return {
        path: r.id,
        score: r.score,
        snippet: extractExcerpt(fm.body, terms),
      };
    });

    const payload = JSON.stringify(hits);
    return { result: hits, payloadBytes: Buffer.byteLength(payload, 'utf8'), payloadText: payload };
  }

  async *searchStream(query: string): AsyncGenerator<SearchHit> {
    const rawHits = this.index.search(query).slice(0, 10);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const r of rawHits) {
      const raw = this.noteMap.get(r.id) ?? '';
      const fm = parseFrontmatter(raw);
      yield {
        path: r.id,
        score: r.score,
        snippet: extractExcerpt(fm.body, terms),
      };
    }
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const absPath = join(this.vaultRoot, path);
    const content = await readFile(absPath, 'utf8');
    return {
      result: content,
      payloadBytes: Buffer.byteLength(content, 'utf8'),
      payloadText: content,
    };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    const absPath = join(this.vaultRoot, path);
    const buf = Buffer.from(content, 'utf8');
    await writeFile(absPath, buf);
    this.noteMap.set(path, content);
    return { result: undefined, payloadBytes: buf.byteLength };
  }

  async list(path = ''): Promise<BackendResponse<ListEntry[]>> {
    const absPath = path ? join(this.vaultRoot, path) : this.vaultRoot;
    const dirents = await readdir(absPath, { withFileTypes: true });
    const result: ListEntry[] = dirents
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({
        path: path ? `${path}/${e.name}` : e.name,
        isDirectory: e.isDirectory(),
      }));
    const payload = JSON.stringify(result);
    return { result, payloadBytes: Buffer.byteLength(payload, 'utf8'), payloadText: payload };
  }
}

/** Centre a ~200-char window on the first occurrence of any query term. */
function extractExcerpt(text: string, terms: string[], maxLen = 200): string {
  const lower = text.toLowerCase();
  let best = -1;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return text.slice(0, maxLen);
  const start = Math.max(0, best - Math.floor(maxLen / 2));
  return text.slice(start, start + maxLen);
}

/** Pull tag string values from frontmatter data (handles array and scalar, tags/tag keys). */
function extractTagValues(data: Record<string, unknown> | null): string {
  if (!data) return '';
  return ['tags', 'tag']
    .flatMap((k) => {
      const v = data[k];
      if (Array.isArray(v)) return v.filter((t): t is string => typeof t === 'string');
      if (typeof v === 'string') return [v];
      return [];
    })
    .join(' ');
}
