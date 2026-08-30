/**
 * Semantic ranking: chunk every note, embed each chunk, brute-force cosine
 * scan with per-note max-pooling. Built fresh per eval run — at Model2Vec
 * throughput the 10k-note fixture embeds in seconds, so there is no vector
 * cache yet; `buildMs` in the report measures whether ship-phase needs one.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type ChunkPooling,
  chunkNote,
  createVectorSet,
  type Embedder,
  scanTopNotes,
  type VectorSet,
} from '@seekstone/core/embed';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { mapLimit } from '@seekstone/core/pmap';
import { walkVault } from '@seekstone/core/walk';

export interface SemanticIndex {
  set: VectorSet;
  noteCount: number;
  chunkCount: number;
  buildMs: number;
  /** Chunk embedding-input texts in set add order (SHA-314 MaxSim rerank); only when retained. */
  texts?: string[];
}

export async function buildSemanticIndex(
  vaultRoot: string,
  embedder: Embedder,
  opts: { retainTexts?: boolean } = {},
): Promise<SemanticIndex> {
  const t0 = performance.now();
  const notes = (await walkVault(vaultRoot)).filter((f) => f.kind === 'note');
  const set = createVectorSet(embedder.dim);
  const texts: string[] | undefined = opts.retainTexts ? [] : undefined;
  let chunkCount = 0;
  // Reads are concurrency-bounded; embedding is synchronous CPU work on the
  // main thread either way, so it happens inline per note.
  await mapLimit(notes, 32, async (entry) => {
    const raw = await readFile(join(vaultRoot, entry.relPath), 'utf8');
    const relPath = entry.relPath;
    const fm = parseFrontmatter(raw);
    const fmTitle = fm.data?.title;
    const title =
      typeof fmTitle === 'string' && fmTitle.length > 0
        ? fmTitle
        : (relPath.split('/').pop() ?? relPath).replace(/\.md$/, '');
    for (const chunk of chunkNote(title, fm.body)) {
      set.add(relPath, embedder.embed(chunk.text));
      texts?.push(chunk.text);
      chunkCount++;
    }
  });
  return { set, noteCount: notes.length, chunkCount, buildMs: performance.now() - t0, texts };
}

/** Top-`k` notes by pooled chunk cosine similarity, with scores. */
export function rankSemanticScored(
  embedder: Embedder,
  index: SemanticIndex,
  query: string,
  k = 50,
  pooling: ChunkPooling = 'max',
): Array<{ path: string; score: number; chunk: number }> {
  return scanTopNotes(embedder.embed(query), index.set, k, pooling);
}
