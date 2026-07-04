import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { basenameNoExt } from './search.js';

const OPS_WITHOUT_VALUE = new Set(['exists', 'missing']);

const Predicate = z
  .object({
    key: z.string().min(1).describe('Frontmatter key to test (top-level).'),
    op: z
      .enum(['eq', 'ne', 'contains', 'exists', 'missing', 'gt', 'gte', 'lt', 'lte'])
      .describe(
        'eq/ne compare scalars; contains matches array membership or substring; ' +
          'exists/missing test key presence; gt/gte/lt/lte compare numbers or strings (ISO dates sort correctly).',
      ),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .optional()
      .describe('Comparison value. Required for every op except exists/missing.'),
  })
  .refine((p) => OPS_WITHOUT_VALUE.has(p.op) || p.value !== undefined, {
    message: 'value is required for this op',
  });

const ISO_DATE = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'not a parseable date' });

export const QueryNotesInput = z.object({
  where: z
    .array(Predicate)
    .max(20)
    .default([])
    .describe('Frontmatter predicates. All must match (AND).'),
  folder: z
    .string()
    .optional()
    .describe('Restrict to notes under this vault-relative folder prefix.'),
  tag: z.string().optional().describe('Restrict to notes with this tag (# prefix optional).'),
  modifiedAfter: ISO_DATE.optional().describe(
    'Only notes modified at or after this ISO 8601 date/time.',
  ),
  modifiedBefore: ISO_DATE.optional().describe(
    'Only notes modified before this ISO 8601 date/time.',
  ),
  minSizeBytes: z.number().int().min(0).optional().describe('Only notes at least this many bytes.'),
  maxSizeBytes: z.number().int().min(0).optional().describe('Only notes at most this many bytes.'),
  select: z
    .array(z.string())
    .max(20)
    .default([])
    .describe(
      'Extra fields to return per hit: frontmatter keys, or the specials "mtime", "size", "tags". ' +
        'Default returns only path + title, keeping the payload minimal.',
    ),
  sort: z.enum(['path', 'title', 'mtime', 'size']).default('path').describe('Sort field.'),
  order: z.enum(['asc', 'desc']).default('asc').describe('Sort order.'),
  limit: z.number().int().min(1).max(500).default(100).describe('Maximum number of results.'),
});
export type QueryNotesInput = z.infer<typeof QueryNotesInput>;

export interface QueryHit {
  path: string;
  /** Omitted when it equals the path's basename (recoverable from `path`). */
  title?: string;
  /** ISO 8601 mtime — present only when "mtime" is selected. */
  mtime?: string;
  /** Present only when "size" is selected. */
  sizeBytes?: number;
  /** Present only when "tags" is selected and the note has tags. */
  tags?: string[];
  /** Selected frontmatter keys — present only when the note has at least one of them. */
  fm?: Record<string, unknown>;
}

type Scalar = string | number | boolean;

/** Loose scalar equality: strict first, then string-form — so `5` matches "5" and dates match. */
function scalarEq(a: unknown, b: Scalar): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || typeof a === 'object') return false;
  return String(a) === String(b);
}

/** Numeric when both sides coerce to finite numbers, else lexicographic (ISO dates sort correctly). */
function compare(a: unknown, b: Scalar): number | undefined {
  if (a === null || a === undefined || typeof a === 'object' || typeof a === 'boolean') {
    return undefined;
  }
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function matches(fm: Record<string, unknown> | null, p: z.infer<typeof Predicate>): boolean {
  const val = fm?.[p.key];
  switch (p.op) {
    case 'exists':
      return val !== undefined;
    case 'missing':
      return val === undefined;
    case 'eq':
      return scalarEq(val, p.value as Scalar);
    // `ne` requires the key to exist — notes without the key don't match.
    case 'ne':
      return val !== undefined && !scalarEq(val, p.value as Scalar);
    case 'contains': {
      if (Array.isArray(val)) return val.some((v) => scalarEq(v, p.value as Scalar));
      if (typeof val === 'string') {
        return val.toLowerCase().includes(String(p.value).toLowerCase());
      }
      return false;
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const c = compare(val, p.value as Scalar);
      if (c === undefined) return false;
      if (p.op === 'gt') return c > 0;
      if (p.op === 'gte') return c >= 0;
      if (p.op === 'lt') return c < 0;
      return c <= 0;
    }
  }
}

export function queryNotes(ctx: ServerContext, input: QueryNotesInput): QueryHit[] {
  const tag = input.tag?.replace(/^#/, '');
  const after = input.modifiedAfter ? Date.parse(input.modifiedAfter) : undefined;
  const before = input.modifiedBefore ? Date.parse(input.modifiedBefore) : undefined;
  const fmKeys = input.select.filter((s) => s !== 'mtime' && s !== 'size' && s !== 'tags');

  const hits: { hit: QueryHit; note: { title: string; mtimeMs: number; sizeBytes: number } }[] = [];

  for (const [path, note] of ctx.notes) {
    if (input.folder && !path.startsWith(input.folder)) continue;
    if (tag && !note.tags.split(' ').filter(Boolean).includes(tag)) continue;
    if (after !== undefined && note.mtimeMs < after) continue;
    if (before !== undefined && note.mtimeMs >= before) continue;
    if (input.minSizeBytes !== undefined && note.sizeBytes < input.minSizeBytes) continue;
    if (input.maxSizeBytes !== undefined && note.sizeBytes > input.maxSizeBytes) continue;
    if (!input.where.every((p) => matches(note.fm, p))) continue;

    const hit: QueryHit = { path };
    // Omit redundant/empty metadata to keep the payload lean (recoverable from `path`).
    if (note.title && note.title !== basenameNoExt(path)) hit.title = note.title;
    if (input.select.includes('mtime')) hit.mtime = new Date(note.mtimeMs).toISOString();
    if (input.select.includes('size')) hit.sizeBytes = note.sizeBytes;
    if (input.select.includes('tags')) {
      const noteTags = note.tags.split(' ').filter(Boolean);
      if (noteTags.length > 0) hit.tags = noteTags;
    }
    if (fmKeys.length > 0 && note.fm) {
      const fm: Record<string, unknown> = {};
      for (const k of fmKeys) {
        if (note.fm[k] !== undefined) fm[k] = note.fm[k];
      }
      if (Object.keys(fm).length > 0) hit.fm = fm;
    }
    hits.push({ hit, note });
  }

  const dir = input.order === 'desc' ? -1 : 1;
  hits.sort((a, b) => {
    switch (input.sort) {
      case 'mtime':
        return (a.note.mtimeMs - b.note.mtimeMs) * dir;
      case 'size':
        return (a.note.sizeBytes - b.note.sizeBytes) * dir;
      case 'title':
        return a.note.title.localeCompare(b.note.title) * dir;
      default:
        return a.hit.path.localeCompare(b.hit.path) * dir;
    }
  });

  return hits.slice(0, input.limit).map((h) => h.hit);
}
