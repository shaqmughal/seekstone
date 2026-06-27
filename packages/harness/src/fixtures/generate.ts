import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Article } from './parse-volume.js';
import { Rng, zipfCdf, zipfPick } from './prng.js';
import { buildTagVocab } from './tags.js';

export interface GenerateOptions {
  /** Deduped, sorted article pool from loadCorpus(). */
  corpus: Article[];
  /** Total number of notes to emit (default 10000). */
  count?: number;
  /** PRNG seed (default 42). Same corpus + count + seed → identical vault. */
  seed?: number;
  /** Vault output directory. Wiped and recreated. */
  outDir: string;
}

export interface GenerateResult {
  notes: number;
  articleNotes: number;
  dailyNotes: number;
  mocNotes: number;
  systemNotes: number;
  attachments: number;
  wikilinks: number;
  unresolvedTargets: number;
  externalUrls: number;
  notesWithFrontmatter: number;
}

const EPOCH = Date.UTC(2023, 0, 1); // fixed base date for deterministic dates
const DAY = 86_400_000;
const EXTRA_URLS = [
  'https://archive.org/details/encyclopaediabri',
  'https://www.gutenberg.org/ebooks/author/various',
  'https://www.britannica.com/',
  'https://commons.wikimedia.org/',
  'https://www.worldcat.org/',
];

/** Double-quote a scalar for YAML (JSON form is valid YAML for our values). */
function yv(s: string): string {
  return JSON.stringify(s);
}

function dateStr(rng: Rng, spanDays = 900): string {
  const ms = EPOCH + rng.int(0, spanDays) * DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Filenames: titles are already clean headwords, but guard path separators. */
function fileSafe(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '-').trim();
}

function wikisourceUrl(title: string): string {
  return `https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/${title.replace(/ /g, '_')}`;
}

/** A skewed outbound-link count: many notes 0-2, a few up to ~8. */
function linkCount(rng: Rng): number {
  const x = rng.next();
  if (x < 0.3) return 0;
  if (x < 0.62) return 1;
  if (x < 0.82) return rng.int(2, 3);
  if (x < 0.95) return rng.int(4, 6);
  return rng.int(7, 12);
}

function inlineTagCount(rng: Rng): number {
  const x = rng.next();
  if (x < 0.25) return 0;
  if (x < 0.6) return 1;
  if (x < 0.85) return 2;
  if (x < 0.95) return 3;
  return 4;
}

export function generateVault(opts: GenerateOptions): GenerateResult {
  const count = opts.count ?? 10_000;
  const seed = opts.seed ?? 42;
  const rng = new Rng(seed);
  const { outDir, corpus } = opts;

  if (corpus.length < Math.ceil(count * 0.8)) {
    throw new Error(`corpus too small: ${corpus.length} articles for count=${count}`);
  }

  // --- Allocate the note budget across kinds. ---
  const dailyNotes = Math.round(count * 0.1);
  const mocNotes = Math.max(8, Math.round(count * 0.015));
  const systemNotes = 12;
  const articleCount = count - dailyNotes - mocNotes - systemNotes;

  // Sample article notes; keep the remainder as a pool of real-but-absent
  // titles to use as *unresolved* wikilink targets.
  const shuffled = rng.shuffle([...corpus]);
  const used = shuffled.slice(0, articleCount);
  const unresolvedPool = shuffled.slice(articleCount).map((a) => a.title);
  const usedTitles = used.map((a) => a.title);

  const tagVocab = buildTagVocab(320);
  const tagCdf = zipfCdf(tagVocab.length);
  const pickTag = () => tagVocab[zipfPick(rng, tagCdf)] as string;
  // Resolved link targets are biased toward a "popular" head so some notes
  // accrue many inbound links (matching the real most-linked-notes tail).
  const titleCdf = zipfCdf(usedTitles.length);

  const result: GenerateResult = {
    notes: 0,
    articleNotes: 0,
    dailyNotes: 0,
    mocNotes: 0,
    systemNotes: 0,
    attachments: 0,
    wikilinks: 0,
    unresolvedTargets: 0,
    externalUrls: 0,
    notesWithFrontmatter: 0,
  };

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const write = (rel: string, content: string) => {
    const abs = join(outDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };

  const wikilink = (): string => {
    result.wikilinks++;
    if (rng.chance(0.37) && unresolvedPool.length > 0) {
      result.unresolvedTargets++;
      return rng.pick(unresolvedPool);
    }
    return usedTitles[zipfPick(rng, titleCdf)] as string;
  };

  // --- Article notes. ---
  // Folder taxonomy with a realistic skew (one dominant folder, a long tail).
  const folderFor = (i: number): string => {
    const x = i / used.length;
    if (x < 0.6) return 'Encyclopedia';
    if (x < 0.75) return 'Reference';
    if (x < 0.87) return 'Sources';
    if (x < 0.97) return 'Notes';
    return '0 Inbox';
  };

  used.forEach((article, i) => {
    const folder = folderFor(i);
    const letter = (article.title[0] ?? 'X').toUpperCase().replace(/[^A-Z]/, '#');
    const rel =
      folder === 'Encyclopedia'
        ? `${folder}/${letter}/${fileSafe(article.title)}.md`
        : `${folder}/${fileSafe(article.title)}.md`;

    const parts: string[] = [];

    // Frontmatter on ~55% of notes.
    const hasFm = rng.chance(0.55);
    if (hasFm) {
      result.notesWithFrontmatter++;
      const fm: string[] = ['---'];
      fm.push(`title: ${yv(article.title)}`);
      fm.push(`date_created: ${dateStr(rng)}`);
      fm.push(`topic: ${pickTag()}`);
      if (rng.chance(0.5)) fm.push(`type: ${rng.pick(['reference', 'article', 'note', 'source'])}`);
      if (folder === 'Sources' || rng.chance(0.2))
        fm.push(`source: ${yv(wikisourceUrl(article.title))}`);
      if (rng.chance(0.18)) {
        const t = [pickTag(), pickTag()].filter((v, idx, arr) => arr.indexOf(v) === idx);
        fm.push(`tags: [${t.join(', ')}]`);
      }
      if (rng.chance(0.12)) fm.push(`id: ${seed}-${i}`);
      fm.push('---', '');
      parts.push(fm.join('\n'));
    }

    parts.push(`# ${article.title}`, '');
    parts.push(article.body, '');

    // Planted wikilinks (a "See also" block).
    const links = linkCount(rng);
    if (links > 0) {
      const targets = Array.from({ length: links }, () => wikilink());
      parts.push('## See also', '');
      parts.push(targets.map((t) => `- [[${t}]]`).join('\n'), '');
    }

    // External URLs: a Wikisource provenance link + occasional extras.
    const urls: string[] = [wikisourceUrl(article.title)];
    result.externalUrls++;
    if (rng.chance(0.35)) {
      const extra = rng.int(1, 3);
      for (let k = 0; k < extra; k++) {
        urls.push(rng.pick(EXTRA_URLS));
        result.externalUrls++;
      }
    }
    parts.push('## References', '');
    parts.push(urls.map((u) => `- <${u}>`).join('\n'), '');

    // Inline tags.
    const itc = inlineTagCount(rng);
    if (itc > 0) {
      const tags = Array.from({ length: itc }, () => `#${pickTag()}`);
      parts.push(tags.join(' '), '');
    }

    write(rel, parts.join('\n'));
    result.articleNotes++;
  });

  // --- Daily notes: dated, each captures a few articles via wikilinks. ---
  for (let d = 0; d < dailyNotes; d++) {
    const date = new Date(EPOCH + d * DAY).toISOString().slice(0, 10);
    const parts: string[] = [
      '---',
      `date_created: ${date}`,
      'type: daily',
      '---',
      '',
      `# ${date}`,
      '',
    ];
    result.notesWithFrontmatter++;
    parts.push('## Captured', '');
    const n = rng.int(1, 6);
    parts.push(Array.from({ length: n }, () => `- [[${wikilink()}]]`).join('\n'), '');
    if (rng.chance(0.4)) parts.push(`#${pickTag()}`, '');
    write(`Daily Notes/${date}.md`, parts.join('\n'));
    result.dailyNotes++;
  }

  // --- MOC notes: heavy link hubs (one mega-MOC to stress max-outbound). ---
  for (let m = 0; m < mocNotes; m++) {
    const topic = tagVocab[m % tagVocab.length] as string;
    const title = `${topic} MOC`;
    const isMega = m === 0;
    const links = isMega ? Math.min(520, usedTitles.length) : rng.int(10, 60);
    const parts: string[] = [
      '---',
      `title: ${yv(title)}`,
      'type: moc',
      `topic: ${topic}`,
      '---',
      '',
      `# ${title}`,
      '',
      'A map of content linking related articles.',
      '',
    ];
    result.notesWithFrontmatter++;
    parts.push(Array.from({ length: links }, () => `- [[${wikilink()}]]`).join('\n'), '');
    write(`MOCs/${fileSafe(title)}.md`, parts.join('\n'));
    result.mocNotes++;
  }

  // --- System/template/home notes (small, some without frontmatter). ---
  write(
    'Home.md',
    '# Home\n\nWelcome to the reference vault.\n\n- [[Index]]\n- [[MOCs/history MOC]]\n',
  );
  write('Index.md', `# Index\n\n${usedTitles.length} reference articles across the vault.\n`);
  result.systemNotes += 2;
  for (let s = 0; s < systemNotes - 2; s++) {
    const parts = [
      '---',
      'type: template',
      `id: tpl-${s}`,
      '---',
      '',
      `# Template ${s}`,
      '',
      'Reusable note scaffold.',
      '',
    ];
    result.notesWithFrontmatter++;
    write(`Templates/Template ${s}.md`, parts.join('\n'));
    result.systemNotes++;
  }

  // --- `.obsidian/.gitkeep` so the directory is recognized as a real vault. ---
  // Filesystem-direct servers (e.g. obsidian-mcp-pro) validate that `.obsidian/`
  // exists and silently fall back to auto-detecting the user's *personal* vault
  // when it's absent — a correctness and privacy hazard. An empty `.gitkeep` is
  // enough for that check (verified), and unlike real config files (app.json,
  // appearance.json, …) the Obsidian app never rewrites it — so opening a fixture
  // vault in Obsidian (for manual REST captures) produces no tracked-file churn
  // and can't accidentally commit Obsidian's runtime state (incl. the REST key).
  // The walker ignores `.obsidian/`, so this never affects profile/golden stats.
  write('.obsidian/.gitkeep', '');

  // --- Placeholder attachments across every FileKind. ---
  writeAttachments(outDir, result);

  result.notes = result.articleNotes + result.dailyNotes + result.mocNotes + result.systemNotes;
  return result;
}

// Minimal valid-ish binary placeholders. The profiler only stats size + ext, so
// these never need to decode; we keep them tiny and deterministic.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const TINY_PDF = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj
trailer<</Root 1 0 R/Size 4>>
%%EOF
`;
const CANVAS = '{"nodes":[],"edges":[]}\n';
const EXCALIDRAW = '{"type":"excalidraw","version":2,"elements":[],"appState":{}}\n';

function writeAttachments(outDir: string, result: GenerateResult): void {
  const write = (rel: string, content: Buffer | string) => {
    const abs = join(outDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    result.attachments++;
  };
  // A spread of images (the dominant attachment kind in a real vault).
  for (let i = 0; i < 120; i++)
    write(`Attachments/image-${String(i).padStart(3, '0')}.png`, PNG_1x1);
  for (let i = 0; i < 20; i++) write(`Attachments/scan-${i}.pdf`, TINY_PDF);
  for (let i = 0; i < 6; i++) write(`Attachments/board-${i}.canvas`, CANVAS);
  for (let i = 0; i < 4; i++) write(`Excalidraw/drawing-${i}.excalidraw`, EXCALIDRAW);
  for (let i = 0; i < 5; i++) write(`Attachments/clip-${i}.mp4`, `mp4 placeholder ${i}\n`);
  for (let i = 0; i < 3; i++) write(`Attachments/audio-${i}.mp3`, `mp3 placeholder ${i}\n`);
  // A couple of "other" kinds.
  write('Attachments/data.bin', Buffer.from([0, 1, 2, 3]));
  write('System/.gitkeep', '');
}
