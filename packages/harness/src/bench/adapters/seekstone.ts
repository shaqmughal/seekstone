import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerContext } from '../../../../server/src/context.js';
import { buildIndex } from '../../../../server/src/index/build.js';
import { getBacklinks as getBacklinksTool } from '../../../../server/src/tools/get_backlinks.js';
import { getLinks as getLinksTool } from '../../../../server/src/tools/get_links.js';
import { listNotes } from '../../../../server/src/tools/list_notes.js';
import { listTags as listTagsTool } from '../../../../server/src/tools/list_tags.js';
import { outlineNote } from '../../../../server/src/tools/outline_note.js';
import { getPeriodicNote } from '../../../../server/src/tools/periodic_note.js';
import { readNote } from '../../../../server/src/tools/read_note.js';
import { search as searchTool } from '../../../../server/src/tools/search.js';
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

  private constructor(ctx: ServerContext) {
    this.ctx = ctx;
  }

  static async build(opts: SeekstoneAdapterOptions): Promise<SeekstoneAdapter> {
    const { index, notes, backlinks } = await buildIndex(opts.vaultRoot);
    const ctx: ServerContext = { vaultRoot: opts.vaultRoot, index, notes, backlinks };
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
    return {
      result: result.content,
      payloadBytes: result.bytesReturned,
      payloadText: result.content,
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

  async getPeriodicNote(period = 'daily', date?: string): Promise<BackendResponse<unknown>> {
    const result = await getPeriodicNote(this.ctx, { period: period as 'daily', date });
    const payload = JSON.stringify(result);
    return {
      result,
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
      payloadText: payload,
    };
  }
}
