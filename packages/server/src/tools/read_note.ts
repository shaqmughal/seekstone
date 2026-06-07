import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { buildOutline } from '@seekstone/core/outline';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const ReadNoteInput = z
  .object({
    path: z.string().describe('Vault-relative path to the note, e.g. "Daily Notes/2026-05-29.md".'),
    section: z
      .string()
      .optional()
      .describe('Return only this heading section (heading text, # prefix optional).'),
    block: z
      .string()
      .optional()
      .describe('Return only the block anchored by this id (^ prefix optional).'),
    lines: z
      .object({
        from: z.number().int().min(1).describe('First line (1-indexed, inclusive).'),
        to: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Last line (1-indexed, inclusive). Defaults to end of file.'),
      })
      .optional()
      .describe('Return only this line range (1-indexed, inclusive).'),
    includeFrontmatter: z
      .boolean()
      .optional()
      .describe(
        'Include frontmatter in span results. Default false for section/block spans. No effect on lines or whole-note reads.',
      ),
  })
  .refine((v) => [v.section, v.block, v.lines].filter((x) => x !== undefined).length <= 1, {
    message: 'At most one of section, block, or lines may be specified.',
  });
export type ReadNoteInput = z.infer<typeof ReadNoteInput>;

export interface ReadNoteResult {
  path: string;
  content: string;
  /** Bytes in the returned content (UTF-8). */
  bytesReturned: number;
  /** Total UTF-8 byte size of the source file. */
  noteBytes: number;
  /** Character offsets of the returned span in the raw file. Absent for whole-note reads. */
  span?: { charStart: number; charEnd: number };
}

export async function readNote(ctx: ServerContext, input: ReadNoteInput): Promise<ReadNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const raw = await readFile(absPath, 'utf8');
  const noteBytes = Buffer.byteLength(raw, 'utf8');

  // Whole-note read — no selector
  if (input.section === undefined && input.block === undefined && input.lines === undefined) {
    return { path: input.path, content: raw, bytesReturned: noteBytes, noteBytes };
  }

  const fm = parseFrontmatter(raw);
  const outline = buildOutline(raw, { includeBlocks: true });

  let charStart: number;
  let charEnd: number;

  if (input.section !== undefined) {
    const target = input.section.replace(/^#+\s*/, '').trim();
    const heading = outline.headings.find((h) => h.text === target);
    if (!heading) {
      throw new Error(
        JSON.stringify({
          error: 'section_not_found',
          target,
          available: outline.headings.map((h) => h.text),
        }),
      );
    }
    const nextSibling = outline.headings.find(
      (h) => h.byteOffset > heading.byteOffset && h.level <= heading.level,
    );
    charStart = heading.byteOffset;
    charEnd = nextSibling?.byteOffset ?? raw.length;
  } else if (input.block !== undefined) {
    const targetId = input.block.replace(/^\^/, '');
    const block = outline.blocks.find((b) => b.id === targetId);
    if (!block) {
      throw new Error(
        JSON.stringify({
          error: 'block_not_found',
          target: targetId,
          available: outline.blocks.map((b) => b.id),
        }),
      );
    }
    const lineS = block.byteOffset === 0 ? 0 : raw.lastIndexOf('\n', block.byteOffset - 1) + 1;
    const nlAfter = raw.indexOf('\n', block.byteOffset);
    const lineE = nlAfter === -1 ? raw.length : nlAfter + 1;
    charStart = lineS;
    charEnd = lineE;
  } else {
    // lines selector
    const linesRange = input.lines;
    if (linesRange === undefined) throw new Error('internal: unreachable');
    const { from, to } = linesRange;
    const rawLines = raw.split('\n');
    const fromIdx = from - 1; // 0-indexed
    const toIdxInclusive =
      to !== undefined ? Math.min(to - 1, rawLines.length - 1) : rawLines.length - 1;

    let offset = 0;
    charStart = 0;
    charEnd = raw.length;

    for (const [i, line] of rawLines.entries()) {
      if (i === fromIdx) charStart = offset;
      offset += line.length + 1; // +1 for the \n consumed by split
      if (i === toIdxInclusive) {
        charEnd = Math.min(offset, raw.length);
        break;
      }
    }
  }

  // Build content — prepend FM if requested (section/block only)
  let content: string;
  if (input.includeFrontmatter === true && input.lines === undefined) {
    const fmRegion = raw.slice(0, fm.bodyStart);
    const spanContent = raw.slice(charStart, charEnd);
    // Avoid duplicating FM if the span already covers it (e.g. section at bodyStart)
    content = charStart < fm.bodyStart ? spanContent : `${fmRegion}${spanContent}`;
  } else {
    content = raw.slice(charStart, charEnd);
  }

  return {
    path: input.path,
    content,
    bytesReturned: Buffer.byteLength(content, 'utf8'),
    noteBytes,
    span: { charStart, charEnd },
  };
}
