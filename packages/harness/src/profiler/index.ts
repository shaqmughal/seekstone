import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { basename } from 'node:path';
import { type Distribution, summarise } from '../util/percentiles.js';
import { extractInlineTags, extractUrls, extractWikilinks, frontmatterTags } from './extract.js';
import { parseFrontmatter } from './frontmatter.js';
import { type FileEntry, type FileKind, walkVault } from './walk.js';

export interface NoteRecord {
  relPath: string;
  sizeBytes: number;
  mtimeMs: number;
  hasFrontmatter: boolean;
  frontmatterMalformed: boolean;
  frontmatterKeys: string[];
  outboundLinks: number;
  wikilinkTargets: string[];
  externalUrls: number;
  inlineTags: string[];
  frontmatterTags: string[];
}

export interface VaultStats {
  vaultRoot: string;
  snapshotDate: string;
  machine: { platform: string; arch: string; node: string; cpus: number };
  counts: {
    totalFiles: number;
    notes: number;
    attachmentsByKind: Record<FileKind, number>;
    notesByTopDir: Record<string, number>;
  };
  size: {
    totalBytes: number;
    notesBytes: number;
    attachmentsBytes: number;
    noteSizeDistribution: Distribution;
    largestNotes: Array<{ relPath: string; sizeBytes: number }>;
  };
  links: {
    totalWikilinks: number;
    outboundPerNote: Distribution;
    unresolvedWikilinks: number;
    mostLinkedNotes: Array<{ target: string; incoming: number }>;
    totalExternalUrls: number;
  };
  frontmatter: {
    notesWithFrontmatter: number;
    pctNotesWithFrontmatter: number;
    keyFrequency: Array<{ key: string; count: number }>;
    malformedNotes: string[];
  };
  tags: {
    distinctTags: number;
    inlineTagOccurrences: number;
    frontmatterTagOccurrences: number;
    topTags: Array<{ tag: string; count: number }>;
  };
  freshness: {
    modifiedLast7Days: number;
    modifiedLast30Days: number;
    modifiedLast90Days: number;
  };
}

export interface ProfilerOptions {
  vaultRoot: string;
  /** How many largest-note entries to keep. Default 25. */
  largestNotesCount?: number;
  /** How many most-linked notes to keep. Default 25. */
  mostLinkedCount?: number;
  /** How many top tags to keep. Default 50. */
  topTagsCount?: number;
}

export async function profileVault(opts: ProfilerOptions): Promise<VaultStats> {
  const { vaultRoot } = opts;
  const largestN = opts.largestNotesCount ?? 25;
  const mostLinkedN = opts.mostLinkedCount ?? 25;
  const topTagsN = opts.topTagsCount ?? 50;

  const entries = await walkVault(vaultRoot);
  const notes = await Promise.all(entries.filter((e) => e.kind === 'note').map((e) => readNote(e)));

  return aggregate({
    vaultRoot,
    entries,
    notes,
    largestN,
    mostLinkedN,
    topTagsN,
  });
}

async function readNote(entry: FileEntry): Promise<NoteRecord> {
  const text = await readFile(entry.absPath, 'utf8');
  const fm = parseFrontmatter(text);
  const wikilinks = extractWikilinks(fm.body);
  const urls = extractUrls(fm.body);
  const inlineTags = extractInlineTags(fm.body);
  return {
    relPath: entry.relPath,
    sizeBytes: entry.sizeBytes,
    mtimeMs: entry.mtimeMs,
    hasFrontmatter: fm.present && !fm.malformed,
    frontmatterMalformed: fm.malformed,
    frontmatterKeys: fm.keys,
    outboundLinks: wikilinks.length,
    wikilinkTargets: wikilinks.map((w) => w.target),
    externalUrls: urls.length,
    inlineTags,
    frontmatterTags: frontmatterTags(fm.data),
  };
}

interface AggregateInput {
  vaultRoot: string;
  entries: FileEntry[];
  notes: NoteRecord[];
  largestN: number;
  mostLinkedN: number;
  topTagsN: number;
}

function aggregate(input: AggregateInput): VaultStats {
  const { vaultRoot, entries, notes, largestN, mostLinkedN, topTagsN } = input;
  const now = Date.now();
  const day = 86_400_000;

  // --- Counts ---
  const attachmentsByKind: Record<FileKind, number> = {
    note: 0,
    image: 0,
    pdf: 0,
    excalidraw: 0,
    canvas: 0,
    video: 0,
    audio: 0,
    other: 0,
  };
  const notesByTopDir: Record<string, number> = {};
  let totalBytes = 0;
  let notesBytes = 0;
  let attachmentsBytes = 0;
  for (const e of entries) {
    totalBytes += e.sizeBytes;
    attachmentsByKind[e.kind] += 1;
    if (e.kind === 'note') {
      notesBytes += e.sizeBytes;
      notesByTopDir[e.topDir] = (notesByTopDir[e.topDir] ?? 0) + 1;
    } else {
      attachmentsBytes += e.sizeBytes;
    }
  }

  // --- Note size distribution ---
  const noteSizes = notes.map((n) => n.sizeBytes);
  const noteSizeDistribution = summarise(noteSizes);
  const largestNotes = [...notes]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, largestN)
    .map((n) => ({ relPath: n.relPath, sizeBytes: n.sizeBytes }));

  // --- Link graph ---
  // Build a resolution set: basename without `.md` and the full relative path
  // without extension. Obsidian resolves wikilinks against either form.
  const noteIndex = new Set<string>();
  for (const n of notes) {
    noteIndex.add(stripExt(basename(n.relPath)));
    noteIndex.add(stripExt(n.relPath));
  }
  let totalWikilinks = 0;
  let unresolvedWikilinks = 0;
  let totalExternalUrls = 0;
  const incoming = new Map<string, number>();
  for (const n of notes) {
    totalWikilinks += n.outboundLinks;
    totalExternalUrls += n.externalUrls;
    for (const t of n.wikilinkTargets) {
      const normalized = stripExt(t);
      const base = stripExt(basename(t));
      if (noteIndex.has(normalized) || noteIndex.has(base)) {
        incoming.set(base, (incoming.get(base) ?? 0) + 1);
      } else {
        unresolvedWikilinks += 1;
      }
    }
  }
  const outboundPerNote = summarise(notes.map((n) => n.outboundLinks));
  const mostLinkedNotes = [...incoming.entries()]
    .map(([target, count]) => ({ target, incoming: count }))
    .sort((a, b) => b.incoming - a.incoming)
    .slice(0, mostLinkedN);

  // --- Frontmatter ---
  const notesWithFM = notes.filter((n) => n.hasFrontmatter).length;
  const malformedNotes = notes.filter((n) => n.frontmatterMalformed).map((n) => n.relPath);
  const keyFreq = new Map<string, number>();
  for (const n of notes) {
    for (const k of n.frontmatterKeys) keyFreq.set(k, (keyFreq.get(k) ?? 0) + 1);
  }
  const keyFrequency = [...keyFreq.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // --- Tags ---
  const tagCounts = new Map<string, number>();
  let inlineTagOccurrences = 0;
  let frontmatterTagOccurrences = 0;
  for (const n of notes) {
    for (const t of n.inlineTags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      inlineTagOccurrences += 1;
    }
    for (const t of n.frontmatterTags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      frontmatterTagOccurrences += 1;
    }
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topTagsN);

  // --- Freshness ---
  const freshness = {
    modifiedLast7Days: notes.filter((n) => now - n.mtimeMs <= 7 * day).length,
    modifiedLast30Days: notes.filter((n) => now - n.mtimeMs <= 30 * day).length,
    modifiedLast90Days: notes.filter((n) => now - n.mtimeMs <= 90 * day).length,
  };

  return {
    vaultRoot,
    snapshotDate: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpus: cpus().length,
    },
    counts: {
      totalFiles: entries.length,
      notes: notes.length,
      attachmentsByKind,
      notesByTopDir,
    },
    size: {
      totalBytes,
      notesBytes,
      attachmentsBytes,
      noteSizeDistribution,
      largestNotes,
    },
    links: {
      totalWikilinks,
      outboundPerNote,
      unresolvedWikilinks,
      mostLinkedNotes,
      totalExternalUrls,
    },
    frontmatter: {
      notesWithFrontmatter: notesWithFM,
      pctNotesWithFrontmatter: notes.length === 0 ? 0 : (notesWithFM / notes.length) * 100,
      keyFrequency,
      malformedNotes,
    },
    tags: {
      distinctTags: tagCounts.size,
      inlineTagOccurrences,
      frontmatterTagOccurrences,
      topTags,
    },
    freshness,
  };
}

function stripExt(p: string): string {
  return p.replace(/\.md$/i, '');
}
