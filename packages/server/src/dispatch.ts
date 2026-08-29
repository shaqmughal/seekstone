import { type AuditFile, type AuditRecord, classifyError } from './audit.js';
import type { ServerContext } from './context.js';
import type { Logger } from './log.js';
import { AppendNoteInput, appendNote } from './tools/append_note.js';
import { ContextPackInput, contextPack } from './tools/context_pack.js';
import { CreateNoteInput, createNote } from './tools/create_note.js';
import { DeleteNoteInput, deleteNote } from './tools/delete_note.js';
import { GetBacklinksInput, getBacklinks } from './tools/get_backlinks.js';
import { GetLinksInput, getLinks } from './tools/get_links.js';
import { ListNotesInput, listNotes } from './tools/list_notes.js';
import { ListTagsInput, listTags } from './tools/list_tags.js';
import { ListWritesInput, listWrites } from './tools/list_writes.js';
import { MoveNoteInput, moveNote } from './tools/move_note.js';
import { OutlineNoteInput, outlineNote } from './tools/outline_note.js';
import { PatchFrontmatterInput, patchFrontmatter } from './tools/patch_frontmatter.js';
import { PatchNoteInput, patchNote } from './tools/patch_note.js';
import {
  AppendPeriodicNoteInput,
  appendPeriodicNote,
  GetPeriodicNoteInput,
  getPeriodicNote,
} from './tools/periodic_note.js';
import { QueryNotesInput, queryNotes } from './tools/query_notes.js';
import { ReadNoteInput, readNote } from './tools/read_note.js';
import { RenameHeadingInput, renameHeading } from './tools/rename_heading.js';
import { ReplaceInNoteInput, replaceInNote } from './tools/replace_in_note.js';
import { SearchInput, search } from './tools/search.js';
import { UndoWriteInput, undoWrite } from './tools/undo_write.js';

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  /**
   * Op-specific audit metadata set by write-tool cases (paths, counts,
   * flags — never content). Consumed and stripped by dispatch; absent means
   * "nothing to audit" (e.g. get_periodic_note that did not create).
   */
  audit?: Record<string, unknown>;
};

/** Tool names this dispatcher handles — kept in sync with the server's tool list. */
export const HANDLED_TOOLS = [
  'search',
  'query_notes',
  'context_pack',
  'read_note',
  'list_notes',
  'list_tags',
  'create_note',
  'delete_note',
  'move_note',
  'rename_heading',
  'append_note',
  'patch_frontmatter',
  'outline_note',
  'patch_note',
  'get_backlinks',
  'get_links',
  'replace_in_note',
  'get_periodic_note',
  'append_periodic_note',
  'list_writes',
  'undo_write',
] as const;

/**
 * Tools that mutate the vault. Enforced here at dispatch (read-only mode
 * rejects them) and mirrored by tool-list.ts, which unregisters them from
 * tools/list — a new write tool must be added to this set to ship.
 */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  'create_note',
  'delete_note',
  'move_note',
  'rename_heading',
  'append_note',
  'patch_frontmatter',
  'patch_note',
  'replace_in_note',
  'append_periodic_note',
  'undo_write',
]);

// Metadata-safe keys: logged at info. Note content (`content`, `frontmatter`,
// `patch`) and the raw `query` string are intentionally excluded — they only
// reach logs via the debug-level `args` dump.
const META_KEYS = [
  'path',
  'from',
  'to',
  'folder',
  'tag',
  'mode',
  'limit',
  'overwrite',
  'pattern',
  'minCount',
  'sort',
  'order',
  'select',
  'modifiedAfter',
  'modifiedBefore',
  'minSizeBytes',
  'maxSizeBytes',
  'period',
  'date',
  'permanent',
  'prevHash',
  'budgetBytes',
  'seq',
  'force',
] as const;

function safeMeta(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null) return {};
  const a = args as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of META_KEYS) {
    if (a[k] !== undefined) out[k] = a[k];
  }
  if (typeof a.query === 'string') out.queryLen = a.query.length; // not the query itself
  if (Array.isArray(a.where)) out.whereCount = a.where.length; // predicate values may be personal
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
  if (ctx.policy.readOnly && WRITE_TOOLS.has(name)) {
    // Unregistered from tools/list, but a client can still send the call.
    log.info('tool rejected (read-only)', { tool: name, ...meta });
    const rejected: ToolResult = {
      content: [
        {
          type: 'text',
          text: 'Error: Server is read-only (SEEKSTONE_READ_ONLY=1); write tools are disabled.',
        },
      ],
      isError: true,
    };
    return audit(ctx, log, rejected, {
      v: 1,
      ts: new Date().toISOString(),
      tool: name,
      outcome: 'policy_denied',
      policy: 'read_only',
      error: 'read_only',
      durationMs: 0,
      ...pathMeta(meta),
    });
  }
  if (ctx.policy.readOnly && name === 'get_periodic_note') {
    // The one read tool with a write side-effect: force createIfMissing off.
    if (typeof args === 'object' && args !== null) {
      args = { ...(args as Record<string, unknown>), createIfMissing: false };
    }
  }
  const isWrite = WRITE_TOOLS.has(name) || name === 'get_periodic_note';
  const seqBefore = ctx.journal?.lastSeq ?? 0;
  const ts = new Date().toISOString();
  try {
    const { audit: detail, ...result } = await run(ctx, name, args);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    log.info('tool ok', { tool: name, durationMs, resultBytes: resultBytes(result), ...meta });
    if (!isWrite || detail === undefined) return result;
    return audit(ctx, log, result, {
      v: 1,
      ts,
      tool: name,
      outcome: 'ok',
      durationMs,
      ...journalFiles(ctx, seqBefore, detail),
      ...detail,
    });
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
    const failed: ToolResult = {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
    if (!isWrite) return failed;
    return audit(ctx, log, failed, {
      v: 1,
      ts,
      tool: name,
      ...classifyError(message),
      durationMs,
      ...pathMeta(meta),
    });
  }
}

/** Path-shaped metadata (path / from / to / seq) for records of calls that never reached a result. */
function pathMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['path', 'from', 'to', 'seq'] as const)
    if (meta[k] !== undefined) out[k] = meta[k];
  return out;
}

/**
 * The hash-pair spine of an ok record: files + seq from the journal entry
 * this call committed; with the journal off, only the after-hash the tool
 * result carries.
 */
function journalFiles(
  ctx: ServerContext,
  seqBefore: number,
  detail: Record<string, unknown>,
): { seq?: number; files?: AuditFile[] } {
  const entry = ctx.journal?.since(seqBefore).at(-1);
  if (entry !== undefined) {
    return {
      seq: entry.seq,
      files: entry.files.map((f) => ({
        path: f.path,
        hashBefore: f.preHash,
        hashAfter: f.postHash,
      })),
    };
  }
  if (typeof detail.path === 'string' && typeof detail.contentHash === 'string') {
    return { files: [{ path: detail.path, hashAfter: detail.contentHash }] };
  }
  return {};
}

/**
 * Append the record when auditing is on. A failed append turns the (already
 * completed) call into a structured audit_failed error so an unauditable
 * write is never reported as a clean success.
 */
function audit(ctx: ServerContext, log: Logger, result: ToolResult, rec: AuditRecord): ToolResult {
  if (!ctx.audit) return result;
  try {
    ctx.audit.record(rec);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('audit write failed', { tool: rec.tool, error: message });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${JSON.stringify({
            error: 'audit_failed',
            tool: rec.tool,
            outcome: rec.outcome,
            hint: `The audit record could not be written (${message}). The vault operation itself ${
              rec.outcome === 'ok' ? 'DID complete' : 'did not run'
            }; fix SEEKSTONE_AUDIT_FILE before continuing.`,
          })}`,
        },
      ],
      isError: true,
    };
  }
}

async function run(ctx: ServerContext, name: string, args: unknown): Promise<ToolResult> {
  switch (name) {
    case 'search': {
      const input = SearchInput.parse(args);
      const hits = search(ctx, input);
      // Minified: search is the headline context-tax metric — indentation is pure tax.
      return { content: [{ type: 'text', text: JSON.stringify(hits) }] };
    }
    case 'query_notes': {
      const input = QueryNotesInput.parse(args);
      const hits = queryNotes(ctx, input);
      // Minified like search — a second search mode, same context-tax discipline.
      return { content: [{ type: 'text', text: JSON.stringify(hits) }] };
    }
    case 'context_pack': {
      const input = ContextPackInput.parse(args);
      const pack = contextPack(ctx, input);
      // Minified: the assembler meters its byte budget against exactly this serialization.
      return { content: [{ type: 'text', text: JSON.stringify(pack) }] };
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
        content: [
          {
            type: 'text',
            text: `Created ${result.path} (${result.bytesWritten} bytes). contentHash: ${result.contentHash}`,
          },
        ],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          bytesWritten: result.bytesWritten,
          overwrite: input.overwrite,
        },
      };
    }
    case 'delete_note': {
      const input = DeleteNoteInput.parse(args);
      const result = await deleteNote(ctx, input);
      const text = result.trashedTo
        ? `Moved ${result.path} to ${result.trashedTo} (recoverable — restore by moving it back).`
        : `Permanently deleted ${result.path}.`;
      const audit: Record<string, unknown> = {
        path: result.path,
        contentHash: result.contentHash,
        permanent: result.permanent,
      };
      if (result.trashedTo !== undefined) audit.trashedTo = result.trashedTo;
      return { content: [{ type: 'text', text }], audit };
    }
    case 'move_note': {
      const input = MoveNoteInput.parse(args);
      const result = await moveNote(ctx, input);
      let text = `Moved ${result.from} → ${result.to}. Rewrote ${result.linksRewritten} link${
        result.linksRewritten === 1 ? '' : 's'
      } in ${result.notesRewritten} note${result.notesRewritten === 1 ? '' : 's'}.`;
      if (result.skipped?.length) {
        text += ` Skipped (outside SEEKSTONE_WRITE_PATHS): ${result.skipped.join(', ')}.`;
      }
      return {
        content: [{ type: 'text', text }],
        audit: {
          from: result.from,
          to: result.to,
          contentHash: result.contentHash,
          notesRewritten: result.notesRewritten,
          linksRewritten: result.linksRewritten,
          ...(result.skipped?.length ? { skipped: result.skipped } : {}),
        },
      };
    }
    case 'rename_heading': {
      const input = RenameHeadingInput.parse(args);
      const result = await renameHeading(ctx, input);
      let text = `Renamed heading "${result.oldHeading}" → "${result.newHeading}" in ${result.path} (line ${result.line}). Rewrote ${result.linksRewritten} link${
        result.linksRewritten === 1 ? '' : 's'
      } in ${result.notesRewritten} note${result.notesRewritten === 1 ? '' : 's'}. contentHash: ${result.contentHash}`;
      if (result.skipped?.length) {
        text += ` Skipped (outside SEEKSTONE_WRITE_PATHS): ${result.skipped.join(', ')}.`;
      }
      return {
        content: [{ type: 'text', text }],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          line: result.line,
          notesRewritten: result.notesRewritten,
          linksRewritten: result.linksRewritten,
          ...(result.skipped?.length ? { skipped: result.skipped } : {}),
        },
      };
    }
    case 'append_note': {
      const input = AppendNoteInput.parse(args);
      const result = await appendNote(ctx, input);
      return {
        content: [
          {
            type: 'text',
            text: `Appended ${result.bytesWritten} bytes to ${result.path}. contentHash: ${result.contentHash}`,
          },
        ],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          bytesWritten: result.bytesWritten,
        },
      };
    }
    case 'patch_frontmatter': {
      const input = PatchFrontmatterInput.parse(args);
      const result = await patchFrontmatter(ctx, input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        // Key NAMES only — values are note content and never leave the tool.
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          keysChanged: result.keysChanged,
          keysAdded: result.keysAdded,
          keysRemoved: result.keysRemoved,
        },
      };
    }
    case 'outline_note': {
      const input = OutlineNoteInput.parse(args);
      const result = await outlineNote(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'patch_note': {
      const input = PatchNoteInput.parse(args);
      const result = await patchNote(ctx, input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          bytesWritten: result.bytesWritten,
          operation: input.operation,
          targetLine: result.targetResolvedAt.line,
        },
      };
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
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          replacements: result.replacements,
          dryRun: input.dryRun,
        },
      };
    }
    case 'get_periodic_note': {
      const input = GetPeriodicNoteInput.parse(args);
      const result = await getPeriodicNote(ctx, input);
      const out: ToolResult = {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
      // Only the create side-effect is a write worth auditing.
      if (result.created) {
        out.audit = { path: result.path, contentHash: result.contentHash, created: true };
      }
      return out;
    }
    case 'append_periodic_note': {
      const input = AppendPeriodicNoteInput.parse(args);
      const result = await appendPeriodicNote(ctx, input);
      return {
        content: [
          {
            type: 'text',
            text: `Appended ${result.bytesWritten} bytes to ${result.path}. contentHash: ${result.contentHash}`,
          },
        ],
        audit: {
          path: result.path,
          contentHash: result.contentHash,
          bytesWritten: result.bytesWritten,
        },
      };
    }
    case 'list_writes': {
      const input = ListWritesInput.parse(args);
      const result = listWrites(ctx, input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'undo_write': {
      const input = UndoWriteInput.parse(args);
      const result = await undoWrite(ctx, input);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        audit: {
          undoOf: result.seq,
          restored: result.restored.length,
          ...(result.overrode ? { forced: true, overrode: result.overrode.length } : {}),
        },
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
