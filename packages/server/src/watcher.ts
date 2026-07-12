import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { extractLinksWithLines } from '@seekstone/core/extract';
import chokidar from 'chokidar';
import type { BacklinkRef, ServerContext } from './context.js';
import { buildDoc, upsertDoc } from './index/doc.js';
import { resolveLink } from './index/resolve.js';
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
  /**
   * Close the watcher. Returns chokidar's close promise so callers that need
   * deterministic teardown (tests, especially under usePolling where every
   * watched path holds a live stat-poll timer) can await full shutdown;
   * fire-and-forget callers may ignore the result.
   */
  stop: () => Promise<void>;
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
  /**
   * Diagnostic hook fired for every raw chokidar event, before .md filtering
   * and before the index is updated. Receives the chokidar event name, the
   * absolute path as chokidar reported it, and the vault-relative key as
   * computed by toRel(). Use in tests only to capture what chokidar actually
   * emits when a failure needs investigation.
   */
  onRawEvent?: (event: 'add' | 'change' | 'unlink', absPath: string, relPath: string) => void;
}

function removeNoteBacklinks(ctx: ServerContext, relPath: string): void {
  const oldDoc = ctx.notes.get(relPath);
  if (oldDoc === undefined) return;
  for (const link of extractLinksWithLines(oldDoc.raw)) {
    const resolved = resolveLink(link.target, ctx.notes);
    if (resolved === undefined) continue;
    const arr = ctx.backlinks.get(resolved);
    if (arr === undefined) continue;
    const filtered = arr.filter((r) => r.path !== relPath);
    ctx.backlinks.set(resolved, filtered);
  }
}

function addNoteBacklinks(ctx: ServerContext, relPath: string, raw: string): void {
  const seen = new Set<string>();
  for (const link of extractLinksWithLines(raw)) {
    const resolved = resolveLink(link.target, ctx.notes);
    if (resolved === undefined) continue;
    const dedupeKey = `${relPath}\0${resolved}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    let arr = ctx.backlinks.get(resolved);
    if (arr === undefined) {
      arr = [];
      ctx.backlinks.set(resolved, arr);
    }
    const ref: BacklinkRef = { path: relPath, line: link.line, linkType: link.linkType };
    arr.push(ref);
    arr.sort((a, b) => a.path.localeCompare(b.path));
  }
}

export function startWatcher(
  ctx: ServerContext,
  log?: Logger,
  opts?: WatcherOptions,
): WatcherHandle {
  const usePolling = opts?.usePolling ?? process.env.SEEKSTONE_WATCH_POLL === '1';

  // chokidar's followSymlinks=true (the default) calls fs.realpath() on the
  // watched path, so events arrive with the real (resolved) path. On Windows,
  // os.tmpdir() can return 8.3 short paths (e.g. RUNNER~1) while realpath()
  // expands them to the long form. Without pre-resolving here, relative()
  // inside the ignored predicate and toRel() would produce ".." segments;
  // ".." starts with "." and trips the dot-directory filter, silencing every
  // event — the root cause of the flaky "vault path containing spaces" test.
  let vaultRoot = ctx.vaultRoot;
  try {
    vaultRoot = realpathSync(ctx.vaultRoot);
  } catch {
    // Vault doesn't exist yet or can't be resolved — keep original path.
  }

  // Index keys are forward-slash vault-relative paths on every platform.
  const toRel = (abs: string): string => relative(vaultRoot, abs).split(sep).join('/');

  async function upsert(relPath: string, op: 'add' | 'change'): Promise<void> {
    try {
      const raw = await readFile(join(vaultRoot, relPath), 'utf8');
      removeNoteBacklinks(ctx, relPath);
      upsertDoc(ctx, buildDoc(relPath, raw));
      addNoteBacklinks(ctx, relPath, raw);
      log?.debug('index updated', { path: relPath, op });
    } catch {
      // File vanished between event and read — ignore; an unlink will follow.
    }
  }

  function remove(relPath: string): void {
    if (ctx.notes.has(relPath)) {
      removeNoteBacklinks(ctx, relPath);
      ctx.index.discard(relPath);
      ctx.notes.delete(relPath);
      log?.debug('index removed', { path: relPath, op: 'delete' });
    }
  }

  const onUpsert = (op: 'add' | 'change') => (abs: string) => {
    const relPath = toRel(abs);
    opts?.onRawEvent?.(op, abs, relPath);
    if (relPath.endsWith('.md')) void upsert(relPath, op);
  };

  const watcher = chokidar.watch(vaultRoot, {
    // The startup index build already covers existing files.
    ignoreInitial: true,
    usePolling,
    interval: 50,
    binaryInterval: 100,
    // Skip dot-dirs (.obsidian, .git, .trash, …) regardless of where the vault
    // lives — matched on the path relative to the vault root.
    ignored: (p: string) => {
      const rel = relative(vaultRoot, p);
      if (!rel || rel === '.') return false;
      // Exclude ".." — it means "outside the vault root" (a path normalisation
      // mismatch), not a dotfile. Treating ".." as a dot-segment would silence
      // all events if the ignored predicate ever receives an out-of-root path.
      return rel
        .split(sep)
        .filter(Boolean)
        .some((seg) => seg.startsWith('.') && seg !== '..');
    },
  });

  watcher
    .on('add', onUpsert('add'))
    .on('change', onUpsert('change'))
    .on('unlink', (abs: string) => {
      const relPath = toRel(abs);
      opts?.onRawEvent?.('unlink', abs, relPath);
      if (relPath.endsWith('.md')) remove(relPath);
    });

  const ready = new Promise<void>((resolve) => {
    watcher.once('ready', () => {
      resolve();
    });
  });

  return {
    stop: () => watcher.close(),
    ready,
  };
}
