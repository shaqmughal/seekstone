import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import chokidar from 'chokidar';
import type { ServerContext } from './context.js';
import { buildDoc, upsertDoc } from './index/doc.js';
import type { Logger } from './log.js';

/**
 * Watch the vault for .md changes and keep the in-memory index in sync.
 *
 * Uses chokidar rather than `fs.watch(..., { recursive: true })`: recursive
 * native watching is unsupported on Linux, where fs.watch silently misses
 * nested changes. chokidar gives reliable, recursive, cross-platform events.
 *
 * Returns `stop()` to tear down the watcher and a `ready` promise that
 * resolves once chokidar has finished its initial scan and is live.
 */
export interface WatcherHandle {
  stop: () => void;
  ready: Promise<void>;
}

export interface WatcherOptions {
  /**
   * Stat-poll instead of using native OS file events. Slower but reliable on
   * filesystems where native events are unreliable (network mounts, WSL, some
   * containers) and deterministic under load. Defaults to false, or true when
   * SEEKSTONE_WATCH_POLL=1.
   */
  usePolling?: boolean;
}

export function startWatcher(
  ctx: ServerContext,
  log?: Logger,
  opts?: WatcherOptions,
): WatcherHandle {
  const usePolling = opts?.usePolling ?? process.env.SEEKSTONE_WATCH_POLL === '1';
  // Index keys are forward-slash vault-relative paths on every platform.
  const toRel = (abs: string): string => relative(ctx.vaultRoot, abs).split(sep).join('/');

  async function upsert(relPath: string, op: 'add' | 'change'): Promise<void> {
    try {
      const raw = await readFile(join(ctx.vaultRoot, relPath), 'utf8');
      upsertDoc(ctx, buildDoc(relPath, raw));
      log?.debug('index updated', { path: relPath, op });
    } catch {
      // File vanished between event and read — ignore; an unlink will follow.
    }
  }

  function remove(relPath: string): void {
    if (ctx.notes.has(relPath)) {
      ctx.index.discard(relPath);
      ctx.notes.delete(relPath);
      log?.debug('index removed', { path: relPath, op: 'delete' });
    }
  }

  const onUpsert = (op: 'add' | 'change') => (abs: string) => {
    const relPath = toRel(abs);
    if (relPath.endsWith('.md')) void upsert(relPath, op);
  };

  const watcher = chokidar.watch(ctx.vaultRoot, {
    // The startup index build already covers existing files.
    ignoreInitial: true,
    usePolling,
    interval: 50,
    binaryInterval: 100,
    // Skip dot-dirs (.obsidian, .git, .trash, …) regardless of where the vault
    // lives — matched on the path relative to the vault root.
    ignored: (p: string) => {
      const rel = relative(ctx.vaultRoot, p);
      if (!rel || rel === '.') return false;
      return rel
        .split(sep)
        .filter(Boolean)
        .some((seg) => seg.startsWith('.'));
    },
  });

  watcher
    .on('add', onUpsert('add'))
    .on('change', onUpsert('change'))
    .on('unlink', (abs: string) => {
      const relPath = toRel(abs);
      if (relPath.endsWith('.md')) remove(relPath);
    });

  const ready = new Promise<void>((resolve) => {
    watcher.once('ready', () => resolve());
  });

  return {
    stop: () => void watcher.close(),
    ready,
  };
}
