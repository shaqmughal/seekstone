import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerContext } from '../../../../server/src/context.js';
import { buildIndex } from '../../../../server/src/index/build.js';
import { Journal, resolveJournalConfig } from '../../../../server/src/journal.js';
import { PERMISSIVE_POLICY } from '../../../../server/src/policy.js';
import { contextPack as contextPackTool } from '../../../../server/src/tools/context_pack.js';
import { createNote as createNoteTool } from '../../../../server/src/tools/create_note.js';
import { deleteNote as deleteNoteTool } from '../../../../server/src/tools/delete_note.js';
import { getBacklinks as getBacklinksTool } from '../../../../server/src/tools/get_backlinks.js';
import { getLinks as getLinksTool } from '../../../../server/src/tools/get_links.js';
import { listNotes } from '../../../../server/src/tools/list_notes.js';
import { listTags as listTagsTool } from '../../../../server/src/tools/list_tags.js';
import { listTasks as listTasksTool } from '../../../../server/src/tools/list_tasks.js';
import { moveNote as moveNoteTool } from '../../../../server/src/tools/move_note.js';
import { outlineNote } from '../../../../server/src/tools/outline_note.js';
import { readNote } from '../../../../server/src/tools/read_note.js';
import {
  DEFAULT_BUDGET_BYTES as READ_NOTES_DEFAULT_BUDGET,
  readNotes as readNotesTool,
} from '../../../../server/src/tools/read_notes.js';
import { search as searchTool } from '../../../../server/src/tools/search.js';
import { undoWrite as undoWriteTool } from '../../../../server/src/tools/undo_write.js';
import { updateTask as updateTaskTool } from '../../../../server/src/tools/update_task.js';
import { vaultStats as vaultStatsTool } from '../../../../server/src/tools/vault_stats.js';
import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';

export interface SeekstoneAdapterOptions {
  vaultRoot: string;
}

/**
 * Seekstone-direct adapter: calls the server's own tool handler functions in-process.
 * Zero serialization overhead beyond JSON.stringify for payload measurement.
 * This is the most accurate benchmark of what seekstone's algorithms cost —
 * no MCP transport, no subprocess, no IPC.
 */
export class SeekstoneAdapter implements Backend {
  readonly name = 'seekstone';
  readonly description = 'Seekstone server (in-process function calls, no IPC)';

  private readonly ctx: ServerContext;
  /**
   * vault_stats's reference time: the newest note's mtime, so the
   * modified-in-1/7/30-days counts (and the payload) depend only on the
   * vault snapshot, not on when the harness runs.
   */
  private readonly statsNow: number;

  private constructor(ctx: ServerContext) {
    this.ctx = ctx;
    let newest = 0;
    for (const note of ctx.notes.values()) newest = Math.max(newest, note.mtimeMs);
    this.statsNow = newest;
  }

  static async build(opts: SeekstoneAdapterOptions): Promise<SeekstoneAdapter> {
    const { index, notes, backlinks, attachments, unresolved } = await buildIndex(opts.vaultRoot);
    const ctx: ServerContext = {
      vaultRoot: opts.vaultRoot,
      index,
      notes,
      generation: 0,
      backlinks,
      attachments,
      unresolved,
      policy: PERMISSIVE_POLICY,
    };
    return new SeekstoneAdapter(ctx);
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const hits = searchTool(this.ctx, { query, limit: 10 });
    const payload = JSON.stringify(hits);
    const mapped: SearchHit[] = hits.map((h) => ({
      path: h.path,
      score: h.score,
      snippet: h.excerpt,
    }));
    return {
      result: mapped,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async *searchStream(query: string): AsyncGenerator<SearchHit> {
    const hits = searchTool(this.ctx, { query, limit: 10 });
    for (const h of hits) {
      yield { path: h.path, score: h.score, snippet: h.excerpt };
    }
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const result = await readNote(this.ctx, { path });
    // Measured as dispatch sends read_note (indented JSON), so the read ×K
    // arm and the read_notes arm count the same thing (SHA-339).
    const payload = JSON.stringify(result, null, 2);
    return {
      result: result.content,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async readMany(paths: string[], budgetBytes?: number): Promise<BackendResponse<unknown>> {
    // Direct fn call bypasses the zod schema, so apply its default here.
    const result = await readNotesTool(this.ctx, {
      items: paths.map((path) => ({ path })),
      budgetBytes: budgetBytes ?? READ_NOTES_DEFAULT_BUDGET,
    });
    // Minified like the dispatch case.
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    const buf = Buffer.from(content, 'utf8');
    await writeFile(join(this.ctx.vaultRoot, path), buf);
    return { result: undefined, payloadBytes: buf.byteLength };
  }

  async list(path?: string): Promise<BackendResponse<ListEntry[]>> {
    const notes = listNotes(this.ctx, { folder: path, limit: 500 });
    const entries: ListEntry[] = notes.map((n) => ({ path: n.path, isDirectory: false }));
    const payload = JSON.stringify(entries);
    return {
      result: entries,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async listTags(): Promise<BackendResponse<unknown>> {
    const result = listTagsTool(this.ctx, { sort: 'count' });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async listTasks(filter?: {
    path?: string;
    folder?: string;
    tag?: string;
    state?: string;
    limit?: number;
  }): Promise<BackendResponse<unknown>> {
    // Direct fn call bypasses the zod schema, so apply its defaults here.
    const result = listTasksTool(this.ctx, {
      ...filter,
      state: filter?.state ?? 'open',
      limit: filter?.limit ?? 100,
    });
    // Minified like the dispatch case — the payload IS the thesis here.
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async vaultStats(): Promise<BackendResponse<unknown>> {
    const result = vaultStatsTool(this.ctx, this.statsNow);
    // Minified like the dispatch case.
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async contextPack(query: string, budgetBytes?: number): Promise<BackendResponse<unknown>> {
    // Direct fn call bypasses the zod schema, so apply its default here.
    const result = contextPackTool(this.ctx, { query, budgetBytes: budgetBytes ?? 2048 });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async outline(path: string): Promise<BackendResponse<unknown>> {
    const result = await outlineNote(this.ctx, { path, includeBlocks: true, includeSizes: false });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async getBacklinks(path: string): Promise<BackendResponse<unknown>> {
    const result = await getBacklinksTool(this.ctx, { path });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  async getLinks(path: string): Promise<BackendResponse<unknown>> {
    const result = await getLinksTool(this.ctx, { path });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }

  // ── Write-safety methods: the server's own tool handlers, in-process ──────
  // This is the run that PROVES the guarantees in docs/WRITE-SAFETY.md — the
  // same code paths an MCP client exercises, minus the transport.

  /**
   * The write journal is opened lazily by the first safety-method call, so
   * a bench run (reads + raw `write`) never creates `.seekstone/` inside the
   * committed fixture vault — only the safety runner's scratch copy gets one.
   */
  private async ensureJournal(): Promise<void> {
    if (this.ctx.journal) return;
    const cfg = resolveJournalConfig({}) as NonNullable<ReturnType<typeof resolveJournalConfig>>;
    this.ctx.journal = await Journal.open(this.ctx.vaultRoot, cfg);
  }

  async deleteNote(path: string): Promise<void> {
    await this.ensureJournal();
    await deleteNoteTool(this.ctx, { path });
  }

  async createNote(path: string, content: string): Promise<void> {
    await this.ensureJournal();
    await createNoteTool(this.ctx, { path, content });
  }

  async readWithHash(path: string): Promise<{ content: string; hash: string }> {
    const result = await readNote(this.ctx, { path });
    return { content: result.content, hash: result.contentHash };
  }

  async casWrite(path: string, content: string, prevHash: string): Promise<void> {
    // create_note with overwrite + prevHash is the server's whole-file
    // guarded replace.
    await this.ensureJournal();
    await createNoteTool(this.ctx, { path, content, overwrite: true, prevHash });
  }

  async casMove(from: string, to: string, prevHash: string): Promise<void> {
    await this.ensureJournal();
    await moveNoteTool(this.ctx, { from, to, prevHash });
  }

  async casDelete(path: string, prevHash: string): Promise<void> {
    await this.ensureJournal();
    await deleteNoteTool(this.ctx, { path, prevHash });
  }

  async undoLastWrite(): Promise<void> {
    await this.ensureJournal();
    await undoWriteTool(this.ctx, {});
  }

  async updateTask(path: string, line: number, state: string, expectText?: string): Promise<void> {
    await this.ensureJournal();
    await updateTaskTool(this.ctx, { path, line, state, expectText });
  }
}
