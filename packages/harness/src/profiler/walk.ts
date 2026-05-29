import { stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import fg from 'fast-glob';

/**
 * Categories we care about. Anything else falls into `other`.
 * Excalidraw saves as `.excalidraw` (sometimes `.excalidraw.md` — handled in classify()).
 */
export type FileKind =
  | 'note'
  | 'image'
  | 'pdf'
  | 'excalidraw'
  | 'canvas'
  | 'video'
  | 'audio'
  | 'other';

export interface FileEntry {
  absPath: string;
  relPath: string;
  topDir: string;
  ext: string;
  kind: FileKind;
  sizeBytes: number;
  mtimeMs: number;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.heic']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.ogg']);

/**
 * Obsidian's own dot-directories plus VCS noise. We deliberately don't ignore
 * dotfiles at the *file* level — users sometimes commit `.gitkeep` etc. — but
 * any top-level dotted directory is treated as non-vault content.
 */
const IGNORE_GLOBS = [
  '**/.obsidian/**',
  '**/.trash/**',
  '**/.git/**',
  '**/.DS_Store',
  '**/node_modules/**',
];

export function classify(relPath: string): FileKind {
  // Excalidraw plugin sometimes writes `.excalidraw.md` — keep those as notes
  // (they still have YAML frontmatter and links), but pure `.excalidraw` is canvas-like.
  if (relPath.endsWith('.excalidraw.md')) return 'note';
  if (relPath.endsWith('.excalidraw')) return 'excalidraw';
  const ext = extname(relPath).toLowerCase();
  if (ext === '.md') return 'note';
  if (ext === '.canvas') return 'canvas';
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return 'other';
}

export async function walkVault(vaultRoot: string): Promise<FileEntry[]> {
  // We use fast-glob with `stats: true` so we can avoid an extra stat() round per file.
  const matches = await fg('**/*', {
    cwd: vaultRoot,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    dot: true, // include dotfiles so the ignore globs are the only gate
    ignore: IGNORE_GLOBS,
    stats: true,
    suppressErrors: true,
  });

  const entries: FileEntry[] = [];
  for (const m of matches) {
    // fast-glob with stats: true returns objects; without, strings. Narrow here.
    const absPath = typeof m === 'string' ? m : m.path;
    const stats = typeof m === 'string' ? await stat(absPath) : m.stats;
    if (!stats) continue;
    const relPath = relative(vaultRoot, absPath);
    const topDir = relPath.split(sep)[0] ?? '';
    entries.push({
      absPath,
      relPath,
      topDir,
      ext: extname(relPath).toLowerCase(),
      kind: classify(relPath),
      sizeBytes: stats.size,
      mtimeMs: stats.mtimeMs,
    });
  }
  return entries;
}

export function _testJoin(...parts: string[]): string {
  return join(...parts);
}
