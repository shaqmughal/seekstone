import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { buildOutline } from '@seekstone/core/outline';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const PatchNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  target: z
    .union([
      z.object({ heading: z.string().describe('Heading text (without # markers).') }),
      z.object({ block: z.string().describe('Block reference ID (without the ^ prefix).') }),
    ])
    .describe('Target section. Provide exactly one of heading or block.'),
  operation: z
    .enum(['append', 'prepend', 'replace'])
    .describe(
      'append: insert after section content. prepend: insert after heading line. replace: swap section content.',
    ),
  content: z.string().min(1).describe('Content to insert or replace with.'),
  createIfMissing: z
    .boolean()
    .default(false)
    .describe(
      'If the heading target is not found, append a new heading (level 2) + content. Only valid for heading targets.',
    ),
});
export type PatchNoteInput = z.infer<typeof PatchNoteInput>;

export interface PatchNoteResult {
  path: string;
  bytesWritten: number;
  targetResolvedAt: { line: number; byteOffset: number };
  frontmatterUnchanged: true;
}

/** Character offset of the start of the next line after `offset`. */
function lineEnd(raw: string, offset: number): number {
  const nl = raw.indexOf('\n', offset);
  return nl === -1 ? raw.length : nl + 1;
}

/** Character offset of the start of the line that contains `offset`. */
function lineStart(raw: string, offset: number): number {
  if (offset === 0) return 0;
  const prev = raw.lastIndexOf('\n', offset - 1);
  return prev === -1 ? 0 : prev + 1;
}

async function atomicWrite(absPath: string, content: string): Promise<void> {
  const tmpPath = `${absPath}.seekstone-patch-tmp`;
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, absPath);
}

export async function patchNote(
  ctx: ServerContext,
  input: PatchNoteInput,
): Promise<PatchNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const raw = await readFile(absPath, 'utf8');
  const fm = parseFrontmatter(raw);
  const originalFmRegion = raw.slice(0, fm.bodyStart);
  const outline = buildOutline(raw, { includeBlocks: true });

  let contentStart: number;
  let contentEnd: number;
  let resolvedAt: { line: number; byteOffset: number };

  if ('heading' in input.target) {
    const targetText = input.target.heading;
    const heading = outline.headings.find((h) => h.text.toLowerCase() === targetText.toLowerCase());

    if (!heading) {
      if (input.createIfMissing) {
        const sep = raw.endsWith('\n\n') ? '' : raw.endsWith('\n') ? '\n' : '\n\n';
        const contentNl = input.content.endsWith('\n') ? '' : '\n';
        const newContent = `${raw}${sep}## ${targetText}\n\n${input.content}${contentNl}`;
        await atomicWrite(absPath, newContent);
        await verifyFrontmatter(absPath, originalFmRegion);
        updateCache(ctx, input.path, newContent, fm.bodyStart);
        const headingOffset = raw.length + sep.length;
        return {
          path: input.path,
          bytesWritten: Buffer.byteLength(newContent, 'utf8'),
          targetResolvedAt: {
            line: newContent.slice(0, headingOffset).split('\n').length,
            byteOffset: headingOffset,
          },
          frontmatterUnchanged: true,
        };
      }
      throw new Error(
        JSON.stringify({
          error: 'heading_not_found',
          target: targetText,
          available: outline.headings.map((h) => h.text),
        }),
      );
    }

    const headingLineEnd = lineEnd(raw, heading.byteOffset);
    const nextSibling = outline.headings.find(
      (h) => h.byteOffset > heading.byteOffset && h.level <= heading.level,
    );
    contentStart = headingLineEnd;
    contentEnd = nextSibling?.byteOffset ?? raw.length;
    resolvedAt = { line: heading.line, byteOffset: heading.byteOffset };
  } else {
    const targetId = input.target.block;
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
    contentStart = lineStart(raw, block.byteOffset);
    contentEnd = lineEnd(raw, block.byteOffset);
    resolvedAt = { line: block.line, byteOffset: block.byteOffset };
  }

  const before = raw.slice(0, contentStart);
  const section = raw.slice(contentStart, contentEnd);
  const after = raw.slice(contentEnd);

  let newContent: string;
  switch (input.operation) {
    case 'prepend': {
      const sep = input.content.endsWith('\n') ? '' : '\n';
      newContent = `${before}${input.content}${sep}${section}${after}`;
      break;
    }
    case 'append': {
      const sectionNl = section.endsWith('\n') ? '' : '\n';
      const contentNl = input.content.endsWith('\n') ? '' : '\n';
      newContent = `${before}${section}${sectionNl}${input.content}${contentNl}${after}`;
      break;
    }
    case 'replace': {
      const contentNl = input.content.endsWith('\n') ? '' : '\n';
      newContent = `${before}${input.content}${contentNl}${after}`;
      break;
    }
    default:
      throw new Error(`Unknown operation: ${String(input.operation)}`);
  }

  await atomicWrite(absPath, newContent);
  await verifyFrontmatter(absPath, originalFmRegion);
  updateCache(ctx, input.path, newContent, fm.bodyStart);

  return {
    path: input.path,
    bytesWritten: Buffer.byteLength(newContent, 'utf8'),
    targetResolvedAt: resolvedAt,
    frontmatterUnchanged: true,
  };
}

async function verifyFrontmatter(absPath: string, originalFmRegion: string): Promise<void> {
  const written = await readFile(absPath, 'utf8');
  if (written.slice(0, originalFmRegion.length) !== originalFmRegion) {
    throw new Error('Write-safety violation: frontmatter region changed unexpectedly');
  }
}

function updateCache(
  ctx: ServerContext,
  path: string,
  newContent: string,
  bodyStart: number,
): void {
  const cached = ctx.notes.get(path);
  if (cached) {
    cached.body = newContent.slice(bodyStart);
    cached.raw = newContent;
    cached.sizeBytes = Buffer.byteLength(newContent, 'utf8');
  }
}
