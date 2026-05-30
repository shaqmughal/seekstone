import { watch } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerContext } from './context.js';
import { buildDoc, upsertDoc } from './index/doc.js';
import type { Logger } from './log.js';

/**
 * Watch the vault root for .md file changes and keep the in-memory index in sync.
 * Returns a function that stops the watcher.
 */
export function startWatcher(ctx: ServerContext, log?: Logger): () => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  async function handle(relPath: string): Promise<void> {
    const absPath = join(ctx.vaultRoot, relPath);
    try {
      await access(absPath);
      const raw = await readFile(absPath, 'utf8');
      const existed = ctx.notes.has(relPath);
      upsertDoc(ctx, buildDoc(relPath, raw));
      log?.debug('index updated', { path: relPath, op: existed ? 'change' : 'add' });
    } catch {
      // File deleted or inaccessible — remove from index.
      if (ctx.notes.has(relPath)) {
        ctx.index.discard(relPath);
        ctx.notes.delete(relPath);
        log?.debug('index removed', { path: relPath, op: 'delete' });
      }
    }
  }

  const watcher = watch(ctx.vaultRoot, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const relPath = filename.replace(/\\/g, '/');
    if (!relPath.endsWith('.md')) return;

    const existing = pending.get(relPath);
    if (existing) clearTimeout(existing);
    pending.set(
      relPath,
      setTimeout(() => {
        pending.delete(relPath);
        handle(relPath).catch(() => {});
      }, 50),
    );
  });

  return () => {
    for (const t of pending.values()) clearTimeout(t);
    watcher.close();
  };
}
