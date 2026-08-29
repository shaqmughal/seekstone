import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import { journalWrite } from '../journal.js';
import { assertWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';

// ── Period type ───────────────────────────────────────────────────────────────

const PERIOD = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
type Period = z.infer<typeof PERIOD>;

// ── Config shapes (read from .obsidian on disk) ───────────────────────────────

interface PeriodicEntry {
  folder?: string;
  format?: string;
  template?: string;
}

interface DailyNotesJson extends PeriodicEntry {}

interface PeriodicNotesJson {
  daily?: PeriodicEntry;
  weekly?: PeriodicEntry;
  monthly?: PeriodicEntry;
  quarterly?: PeriodicEntry;
  yearly?: PeriodicEntry;
}

const DEFAULTS: Record<Period, Required<PeriodicEntry>> = {
  daily: { folder: '', format: 'YYYY-MM-DD', template: '' },
  weekly: { folder: '', format: 'gggg-[W]ww', template: '' },
  monthly: { folder: '', format: 'YYYY-MM', template: '' },
  quarterly: { folder: '', format: 'YYYY-[Q]Q', template: '' },
  yearly: { folder: '', format: 'YYYY', template: '' },
};

async function readJson<T>(absPath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(absPath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function resolveConfig(vaultRoot: string, period: Period): Promise<Required<PeriodicEntry>> {
  const defaults = DEFAULTS[period];

  if (period === 'daily') {
    const cfg = await readJson<DailyNotesJson>(join(vaultRoot, '.obsidian', 'daily-notes.json'));
    return {
      folder: cfg?.folder ?? defaults.folder,
      format: cfg?.format ?? defaults.format,
      template: cfg?.template ?? defaults.template,
    };
  }

  const cfg = await readJson<PeriodicNotesJson>(
    join(vaultRoot, '.obsidian', 'plugins', 'periodic-notes', 'data.json'),
  );
  const entry = cfg?.[period];
  return {
    folder: entry?.folder ?? defaults.folder,
    format: entry?.format ?? defaults.format,
    template: entry?.template ?? defaults.template,
  };
}

// ── Moment-style date formatting (no external dep) ───────────────────────────

function isoWeekAndYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export function formatMomentDate(date: Date, format: string): string {
  // Use UTC accessors: ISO date strings (YYYY-MM-DD) parse as UTC midnight,
  // so local-time accessors would return the previous day in negative-offset
  // timezones (EST, PST, etc.).
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const quarter = Math.ceil(month / 3);
  const { week: isoWeek, year: isoYear } = isoWeekAndYear(date);

  // Protect literal text in square brackets from token substitution.
  const PLACEHOLDER = '\x00';
  const literals: string[] = [];
  let s = format.replace(/\[([^\]]*)\]/g, (_, lit) => {
    literals.push(lit);
    return `${PLACEHOLDER}${literals.length - 1}${PLACEHOLDER}`;
  });

  // Substitute longest tokens first to avoid partial matches (e.g. YYYY before YY).
  s = s
    .replace(/gggg/g, String(isoYear).padStart(4, '0'))
    .replace(/YYYY/g, String(year).padStart(4, '0'))
    .replace(/YY/g, String(year).slice(-2))
    .replace(/MM/g, String(month).padStart(2, '0'))
    .replace(/M/g, String(month))
    .replace(/DD/g, String(day).padStart(2, '0'))
    .replace(/D/g, String(day))
    .replace(/ww/g, String(isoWeek).padStart(2, '0'))
    .replace(/W/g, String(isoWeek))
    .replace(/Q/g, String(quarter));

  // Restore literals. Built via RegExp constructor because the placeholder is a
  // control char (\x00) that Biome disallows in a regex literal; Codacy's
  // non-literal-RegExp pattern is disabled repo-wide for this safe internal use.
  return s.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'),
    (_, i) => literals[+i] ?? '',
  );
}

// ── Resolve a note path from config + date ────────────────────────────────────

export function resolveNotePath(cfg: Required<PeriodicEntry>, date: Date): string {
  const filename = `${formatMomentDate(date, cfg.format)}.md`;
  return cfg.folder ? `${cfg.folder}/${filename}` : filename;
}

// ── Tool: get_periodic_note ───────────────────────────────────────────────────

export const GetPeriodicNoteInput = z.object({
  period: PERIOD.default('daily').describe(
    'Period type: daily (default), weekly, monthly, quarterly, or yearly.',
  ),
  date: z
    .string()
    .optional()
    .describe('ISO date string (YYYY-MM-DD). Defaults to today when omitted.'),
  createIfMissing: z
    .boolean()
    .default(false)
    .describe(
      'Create the note from the configured template if it does not exist. Default false — reports missing without creating.',
    ),
});
export type GetPeriodicNoteInput = z.input<typeof GetPeriodicNoteInput>;

export interface GetPeriodicNoteResult {
  path: string;
  existed: boolean;
  created: boolean;
  /** sha-256 (hex) of the created content; only set when created is true. */
  contentHash?: string;
}

export async function getPeriodicNote(
  ctx: ServerContext,
  rawInput: GetPeriodicNoteInput,
): Promise<GetPeriodicNoteResult> {
  const input = GetPeriodicNoteInput.parse(rawInput);
  const date = input.date ? new Date(input.date) : new Date();
  const cfg = await resolveConfig(ctx.vaultRoot, input.period);
  const path = resolveNotePath(cfg, date);
  const abs = resolveVaultPath(ctx.vaultRoot, path);

  let existed = false;
  try {
    await access(abs);
    existed = true;
  } catch {}

  if (existed) return { path, existed: true, created: false };

  if (!input.createIfMissing) return { path, existed: false, created: false };

  // About to write: this "read" tool creates the note here, so the write
  // policy applies (dispatch also strips createIfMissing in read-only mode).
  assertWritable(ctx.policy, path);

  // Read template if configured.
  let body = '';
  if (cfg.template) {
    try {
      const templateAbs = resolveVaultPath(
        ctx.vaultRoot,
        cfg.template.endsWith('.md') ? cfg.template : `${cfg.template}.md`,
      );
      body = await readFile(templateAbs, 'utf8');
    } catch {}
  }

  await mkdir(dirname(abs), { recursive: true });
  await journalWrite(ctx, 'get_periodic_note', path, null, body);
  await atomicWrite(abs, body);
  upsertDoc(ctx, buildDoc(path, body));

  return { path, existed: false, created: true, contentHash: contentHash(body) };
}

// ── Tool: append_periodic_note ────────────────────────────────────────────────

export const AppendPeriodicNoteInput = z.object({
  period: PERIOD.default('daily').describe('Period type. Default: daily.'),
  date: z.string().optional().describe('ISO date string (YYYY-MM-DD). Defaults to today.'),
  content: z
    .string()
    .min(1)
    .describe('Text to append to the note body. Separated from existing content by a blank line.'),
  createIfMissing: z
    .boolean()
    .default(true)
    .describe('Create the note if it does not exist before appending. Default true.'),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard: the contentHash from a prior read of the resolved periodic note. Fails with hash_conflict if it changed since.',
    ),
});
export type AppendPeriodicNoteInput = z.input<typeof AppendPeriodicNoteInput>;

export interface AppendPeriodicNoteResult {
  path: string;
  bytesWritten: number;
  /** sha-256 (hex) of the new content — usable as prevHash for a chained edit. */
  contentHash: string;
}

export async function appendPeriodicNote(
  ctx: ServerContext,
  rawInput: AppendPeriodicNoteInput,
): Promise<AppendPeriodicNoteResult> {
  const input = AppendPeriodicNoteInput.parse(rawInput);
  const date = input.date ? new Date(input.date) : new Date();
  const cfg = await resolveConfig(ctx.vaultRoot, input.period);
  const path = resolveNotePath(cfg, date);
  const abs = resolveVaultPath(ctx.vaultRoot, path);
  assertWritable(ctx.policy, path);

  let original = '';
  try {
    original = await readFile(abs, 'utf8');
    if (input.prevHash !== undefined) assertHashMatch(original, input.prevHash, path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    if (input.prevHash !== undefined) {
      // The caller pinned a version that no longer exists — conflict, not create.
      throw new Error(
        JSON.stringify({
          error: 'hash_conflict',
          path,
          expected: input.prevHash,
          actual: null,
          hint: 'The periodic note no longer exists on disk. Re-read before retrying.',
        }),
      );
    }
    if (!input.createIfMissing) throw new Error(`Periodic note not found: ${path}`);
    await mkdir(dirname(abs), { recursive: true });
    await journalWrite(ctx, 'append_periodic_note', path, null, input.content);
    await atomicWrite(abs, input.content);
    upsertDoc(ctx, buildDoc(path, input.content));
    return {
      path,
      bytesWritten: Buffer.byteLength(input.content, 'utf8'),
      contentHash: contentHash(input.content),
    };
  }

  // Preserve frontmatter, append to body.
  const fm = parseFrontmatter(original);
  const body = fm.body.endsWith('\n') ? fm.body : `${fm.body}\n`;
  const separator = body.endsWith('\n\n') ? '' : '\n';
  const newBody = `${body}${separator}${input.content}`;
  const header = original.slice(0, fm.bodyStart);
  const newRaw = `${header}${newBody}`;

  await journalWrite(ctx, 'append_periodic_note', path, original, newRaw);
  await atomicWrite(abs, newRaw);

  const cached = ctx.notes.get(path);
  if (cached) {
    cached.body = newBody;
    cached.raw = newRaw;
  }

  return {
    path,
    bytesWritten: Buffer.byteLength(newRaw, 'utf8'),
    contentHash: contentHash(newRaw),
  };
}
