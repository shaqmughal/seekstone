import { lstatSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import chokidar from 'chokidar';
import type { ServerContext } from './context.js';
import { addNoteBacklinks, removeNoteBacklinks } from './index/backlinks.js';
import { buildDoc, removeDoc, upsertDoc } from './index/doc.js';
import { addAttachment, removeAttachment } from './index/resolve.js';
import type { Logger } from './log.js';
import { isReadable } from './policy.js';
import { findLink } from './symlinks.js';

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
   * Stat-poll interval in ms; only meaningful with usePolling. Overrides
   * SEEKSTONE_WATCH_POLL_INTERVAL and the default. Tests pass a small value
   * here so the suite stays fast without dragging production polling down
   * with it.
   */
  pollInterval?: number;
  /**
   * Diagnostic hook fired for every raw chokidar event, before .md filtering
   * and before the index is updated. Receives the chokidar event name, the
   * absolute path as chokidar reported it, and the vault-relative key as
   * computed by toRel(). Use in tests only to capture what chokidar actually
   * emits when a failure needs investigation.
   */
  onRawEvent?: (
    event: 'add' | 'change' | 'unlink' | 'unlinkDir',
    absPath: string,
    relPath: string,
  ) => void;
}

/**
 * Default stat-poll interval (ms) under SEEKSTONE_WATCH_POLL=1. Deliberately
 * slow: poll cost scales with vault size ÷ interval, and on the network/9p
 * mounts where polling is needed at all, a 50ms sweep pinned ~25% of a CPU
 * core per instance (GH #280). Only pickup of *external* edits waits on this —
 * seekstone's own writes update the index in-process.
 */
export const DEFAULT_POLL_INTERVAL_MS = 10_000;

/**
 * Resolve the stat-poll interval: explicit option → SEEKSTONE_WATCH_POLL_INTERVAL
 * (positive integer, ms) → default. A malformed env value warns and falls back
 * rather than throwing — a bad tuning knob shouldn't keep the server down.
 */
export function resolvePollInterval(
  optValue: number | undefined,
  envValue: string | undefined,
  log?: Logger,
): number {
  if (optValue !== undefined) return optValue;
  if (envValue === undefined || envValue === '') return DEFAULT_POLL_INTERVAL_MS;
  const parsed = Number(envValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    log?.warn('invalid SEEKSTONE_WATCH_POLL_INTERVAL, using default', {
      value: envValue,
      defaultMs: DEFAULT_POLL_INTERVAL_MS,
    });
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return parsed;
}

/**
 * What the watcher does with an add/change event, by the symlink rule
 * (SHA-575): `purge` everything indexed under a component that is a link,
 * `ignore` an event whose `lstat` failed (a transient error is not a link, so
 * nothing is indexed and nothing is purged), or `process` it as usual.
 */
export function linkEventAction(
  vaultRoot: string,
  abs: string,
): { kind: 'process' } | { kind: 'ignore' } | { kind: 'purge'; at: string } {
  const link = findLink(vaultRoot, abs);
  if (link === undefined) return { kind: 'process' };
  return link.error ? { kind: 'ignore' } : { kind: 'purge', at: link.at };
}

/**
 * What the watcher does with an `unlinkDir` event: `purge` the folder's
 * entries when it is confirmed gone (or no longer a real directory, such as a
 * link put in its place), `keep` them when it is a real directory again (a
 * git checkout that recreated it), and `skip` the event when the folder can't
 * be inspected (EACCES, EPERM): an error proves nothing, so nothing is purged
 * and the watcher keeps running.
 */
export function unlinkDirAction(abs: string): 'purge' | 'keep' | 'skip' {
  try {
    return lstatSync(abs, { throwIfNoEntry: false })?.isDirectory() === true ? 'keep' : 'purge';
  } catch {
    return 'skip';
  }
}

export function startWatcher(
  ctx: ServerContext,
  log?: Logger,
  opts?: WatcherOptions,
): WatcherHandle {
  const usePolling = opts?.usePolling ?? process.env.SEEKSTONE_WATCH_POLL === '1';
  const pollInterval = resolvePollInterval(
    opts?.pollInterval,
    process.env.SEEKSTONE_WATCH_POLL_INTERVAL,
    log,
  );

  // With followSymlinks=true (chokidar's default, used before SHA-575)
  // chokidar calls fs.realpath() on the watched path, so events arrived with
  // the real (resolved) path. Watching the resolved root keeps event paths,
  // toRel() and the symlink check on the same root either way. On Windows,
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
      // Only a regular file is read: the link check already ran, and this
      // keeps a FIFO or device from being opened.
      const abs = join(vaultRoot, relPath);
      if (lstatSync(abs, { throwIfNoEntry: false })?.isFile() !== true) return;
      const raw = await readFile(abs, 'utf8');
      removeNoteBacklinks(ctx, relPath);
      // upsertDoc checks for links again after the await, with none between
      // that check and the commit; a path that became a link is dropped.
      if (!upsertDoc(ctx, buildDoc(relPath, raw))) {
        ctx.semantic?.noteRemoved(relPath);
        return;
      }
      addNoteBacklinks(ctx, relPath, raw);
      // Semantic re-embeds are debounced internally and read the fresh
      // ctx.notes entry — never the disk — so this stays off the hot path.
      ctx.semantic?.noteChanged(relPath);
      log?.debug('index updated', { path: relPath, op });
    } catch {
      // File vanished between event and read — ignore; an unlink will follow.
    }
  }

  function remove(relPath: string): void {
    if (ctx.notes.has(relPath)) {
      removeDoc(ctx, relPath);
      ctx.semantic?.noteRemoved(relPath);
      log?.debug('index removed', { path: relPath, op: 'delete' });
    }
  }

  /**
   * Drop every note and attachment at or under `prefix` (a vault-relative
   * path). Used when a folder is removed, or when a folder or note is
   * replaced by a symlink: chokidar doesn't always send an unlink for each
   * child, so the index is cleared by prefix.
   */
  function removeUnder(prefix: string): void {
    const under = (p: string) => p === prefix || p.startsWith(`${prefix}/`);
    for (const path of [...ctx.notes.keys()]) if (under(path)) remove(path);
    const attachments: string[] = [];
    for (const list of ctx.attachments.byPath.values()) {
      for (const path of list) if (under(path)) attachments.push(path);
    }
    for (const path of attachments) removeAttachment(ctx.attachments, path);
  }

  const onUpsert = (op: 'add' | 'change') => (abs: string) => {
    const relPath = toRel(abs);
    opts?.onRawEvent?.(op, abs, relPath);
    // Seekstone doesn't follow symlinks (SHA-575). This runs before anything
    // is read. With followSymlinks off, chokidar reports a folder or note
    // replaced by a link as a `change` (or an `add` for a file inside the
    // link's target), so whatever was indexed under the link goes.
    const action = linkEventAction(vaultRoot, abs);
    if (action.kind === 'purge') removeUnder(action.at);
    if (action.kind !== 'process') return;
    // Files outside SEEKSTONE_READ_PATHS never enter the index (SHA-291).
    if (!isReadable(ctx.policy, relPath)) return;
    if (relPath.endsWith('.md')) void upsert(relPath, op);
    // Attachments only track existence. A `change` can still be the first
    // event for one, when a link is replaced by a regular file; addAttachment
    // ignores a path it already has.
    else addAttachment(ctx.attachments, relPath);
  };

  const watcher = chokidar.watch(vaultRoot, {
    // The startup index build already covers existing files.
    ignoreInitial: true,
    // Don't descend into symlinks: the boot walk doesn't either (SHA-575).
    followSymlinks: false,
    usePolling,
    interval: pollInterval,
    binaryInterval: pollInterval * 2,
    // Skip dot-dirs (.obsidian, .git, .trash, …) and node_modules, as the boot
    // walk does, regardless of where the vault lives — matched on the path
    // relative to the vault root.
    ignored: (p: string) => {
      const rel = relative(vaultRoot, p);
      if (!rel || rel === '.') return false;
      // Exclude ".." — it means "outside the vault root" (a path normalisation
      // mismatch), not a dotfile. Treating ".." as a dot-segment would silence
      // all events if the ignored predicate ever receives an out-of-root path.
      return rel
        .split(sep)
        .filter(Boolean)
        .some((seg) => (seg.startsWith('.') && seg !== '..') || seg === 'node_modules');
    },
  });

  watcher
    .on('add', onUpsert('add'))
    .on('change', onUpsert('change'))
    .on('unlink', (abs: string) => {
      const relPath = toRel(abs);
      opts?.onRawEvent?.('unlink', abs, relPath);
      // Not filtered by the read scope: clearing entries is always safe.
      if (relPath.endsWith('.md')) remove(relPath);
      else removeAttachment(ctx.attachments, relPath);
    })
    .on('unlinkDir', (abs: string) => {
      const relPath = toRel(abs);
      opts?.onRawEvent?.('unlinkDir', abs, relPath);
      // Not filtered by the read scope: clearing entries is always safe. If
      // the folder is a real directory again by now (a git checkout that
      // recreated it), its notes are still there, so keep them.
      if (relPath === '') return;
      if (unlinkDirAction(abs) === 'purge') removeUnder(relPath);
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
