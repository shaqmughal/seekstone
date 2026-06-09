import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { buildDoc, upsertDoc } from '../index/doc.js';

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

  // Restore literals.
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
}

export async function getPeriodicNote(
  ctx: ServerContext,
  rawInput: GetPeriodicNoteInput,
): Promise<GetPeriodicNoteResult> {
  const input = GetPeriodicNoteInput.parse(rawInput);
  const date = input.date ? new Date(input.date) : new Date();
  const cfg = await resolveConfig(ctx.vaultRoot, input.period);
  const path = resolveNotePath(cfg, date);
  const abs = join(ctx.vaultRoot, path);

  if (!abs.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${path}`);

  let existed = false;
  try {
    await access(abs);
    existed = true;
  } catch {}

  if (existed) return { path, existed: true, created: false };

  if (!input.createIfMissing) return { path, existed: false, created: false };

  // Read template if configured.
  let body = '';
  if (cfg.template) {
    const templateAbs = join(
      ctx.vaultRoot,
      cfg.template.endsWith('.md') ? cfg.template : `${cfg.template}.md`,
    );
    if (templateAbs.startsWith(ctx.vaultRoot)) {
      try {
        body = await readFile(templateAbs, 'utf8');
      } catch {}
    }
  }

  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body, 'utf8');
  upsertDoc(ctx, buildDoc(path, body));

  return { path, existed: false, created: true };
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
});
export type AppendPeriodicNoteInput = z.input<typeof AppendPeriodicNoteInput>;

export interface AppendPeriodicNoteResult {
  path: string;
  bytesWritten: number;
}

export async function appendPeriodicNote(
  ctx: ServerContext,
  rawInput: AppendPeriodicNoteInput,
): Promise<AppendPeriodicNoteResult> {
  const input = AppendPeriodicNoteInput.parse(rawInput);
  const date = input.date ? new Date(input.date) : new Date();
  const cfg = await resolveConfig(ctx.vaultRoot, input.period);
  const path = resolveNotePath(cfg, date);
  const abs = join(ctx.vaultRoot, path);

  if (!abs.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${path}`);

  let original = '';
  try {
    original = await readFile(abs, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    if (!input.createIfMissing) throw new Error(`Periodic note not found: ${path}`);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, input.content, 'utf8');
    upsertDoc(ctx, buildDoc(path, input.content));
    return { path, bytesWritten: Buffer.byteLength(input.content, 'utf8') };
  }

  // Preserve frontmatter, append to body.
  const fm = parseFrontmatter(original);
  const body = fm.body.endsWith('\n') ? fm.body : `${fm.body}\n`;
  const separator = body.endsWith('\n\n') ? '' : '\n';
  const newBody = `${body}${separator}${input.content}`;
  const header = original.slice(0, fm.bodyStart);
  const newRaw = `${header}${newBody}`;

  await writeFile(abs, newRaw, 'utf8');

  const cached = ctx.notes.get(path);
  if (cached) {
    cached.body = newBody;
    cached.raw = newRaw;
  }

  return { path, bytesWritten: Buffer.byteLength(newRaw, 'utf8') };
}
