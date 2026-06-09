import type { ServerContext } from './context.js';
import type { Logger } from './log.js';
import { AppendNoteInput, appendNote } from './tools/append_note.js';
import { CreateNoteInput, createNote } from './tools/create_note.js';
import { DeleteNoteInput, deleteNote } from './tools/delete_note.js';
import { GetBacklinksInput, getBacklinks } from './tools/get_backlinks.js';
import { GetLinksInput, getLinks } from './tools/get_links.js';
import { ListNotesInput, listNotes } from './tools/list_notes.js';
import { ListTagsInput, listTags } from './tools/list_tags.js';
import { MoveNoteInput, moveNote } from './tools/move_note.js';
import { OutlineNoteInput, outlineNote } from './tools/outline_note.js';
import { PatchFrontmatterInput, patchFrontmatter } from './tools/patch_frontmatter.js';
import { PatchNoteInput, patchNote } from './tools/patch_note.js';
import {
  AppendPeriodicNoteInput,
  GetPeriodicNoteInput,
  appendPeriodicNote,
  getPeriodicNote,
} from './tools/periodic_note.js';
import { ReadNoteInput, readNote } from './tools/read_note.js';
import { ReplaceInNoteInput, replaceInNote } from './tools/replace_in_note.js';
import { SearchInput, search } from './tools/search.js';

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/** Tool names this dispatcher handles — kept in sync with the server's tool list. */
export const HANDLED_TOOLS = [
  'search',
  'read_note',
  'list_notes',
  'list_tags',
  'create_note',
  'delete_note',
  'move_note',
  'append_note',
  'patch_frontmatter',
  'outline_note',
  'patch_note',
  'get_backlinks',
  'get_links',
  'replace_in_note',
  'get_periodic_note',
  'append_periodic_note',
] as const;

// Metadata-safe keys: logged at info. Note content (`content`, `frontmatter`,
// `patch`) and the raw `query` string are intentionally excluded — they only
// reach logs via the debug-level `args` dump.
const META_KEYS = [
  'path',
  'from',
  'to',
  'folder',
  'tag',
  'limit',
  'overwrite',
  'pattern',
  'minCount',
  'sort',
  'period',
  'date',
] as const;

function safeMeta(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null) return {};
  const a = args as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of META_KEYS) {
    if (a[k] !== undefined) out[k] = a[k];
  }
  if (typeof a.query === 'string') out.queryLen = a.query.length; // not the query itself
  return out;
}

function resultBytes(r: ToolResult): number {
  let n = 0;
  for (const c of r.content) n += Buffer.byteLength(c.text);
  return n;
}

/**
 * Route a tool call to its handler, logging the outcome. Returns an MCP tool
 * result; failures are converted to `{ isError: true }` (never thrown) so the
 * transport stays alive, and are logged at `error` with a stack.
 */
export async function dispatch(
  ctx: ServerContext,
  name: string,
  args: unknown,
  log: Logger,
): Promise<ToolResult> {
  const start = performance.now();
  const meta = safeMeta(args);
  log.debug('tool start', { tool: name, args }); // full args (may include content) — debug only
  try {
    const result = await run(ctx, name, args);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    log.info('tool ok', { tool: name, durationMs, resultBytes: resultBytes(result), ...meta });
    return result;
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const message = err instanceof Error ? err.message : String(err);
    log.error('tool error', {
      tool: name,
      durationMs,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
      ...meta,
    });
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
}

async function run(ctx: ServerContext, name: string, args: unknown): Promise<ToolResult> {
  switch (name) {
    case 'search': {
      const input = SearchInput.parse(args);
      const hits = search(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }] };
    }
    case 'read_note': {
      const input = ReadNoteInput.parse(args);
      const result = await readNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'list_notes': {
      const input = ListNotesInput.parse(args);
      const entries = listNotes(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] };
    }
    case 'list_tags': {
      const input = ListTagsInput.parse(args);
      const result = listTags(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'create_note': {
      const input = CreateNoteInput.parse(args);
      const result = await createNote(ctx, input);
      return {
        content: [{ type: 'text', text: `Created ${result.path} (${result.bytesWritten} bytes).` }],
      };
    }
    case 'delete_note': {
      const input = DeleteNoteInput.parse(args);
      await deleteNote(ctx, input);
      return { content: [{ type: 'text', text: `Deleted ${input.path}.` }] };
    }
    case 'move_note': {
      const input = MoveNoteInput.parse(args);
      const result = await moveNote(ctx, input);
      return { content: [{ type: 'text', text: `Moved ${result.from} → ${result.to}.` }] };
    }
    case 'append_note': {
      const input = AppendNoteInput.parse(args);
      const result = await appendNote(ctx, input);
      return {
        content: [
          { type: 'text', text: `Appended ${result.bytesWritten} bytes to ${result.path}.` },
        ],
      };
    }
    case 'patch_frontmatter': {
      const input = PatchFrontmatterInput.parse(args);
      const result = await patchFrontmatter(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'outline_note': {
      const input = OutlineNoteInput.parse(args);
      const result = await outlineNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'patch_note': {
      const input = PatchNoteInput.parse(args);
      const result = await patchNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'get_backlinks': {
      const input = GetBacklinksInput.parse(args);
      const result = getBacklinks(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'get_links': {
      const input = GetLinksInput.parse(args);
      const result = getLinks(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'replace_in_note': {
      const input = ReplaceInNoteInput.parse(args);
      const result = await replaceInNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'get_periodic_note': {
      const input = GetPeriodicNoteInput.parse(args);
      const result = await getPeriodicNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'append_periodic_note': {
      const input = AppendPeriodicNoteInput.parse(args);
      const result = await appendPeriodicNote(ctx, input);
      return {
        content: [
          {
            type: 'text',
            text: `Appended ${result.bytesWritten} bytes to ${result.path}.`,
          },
        ],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
