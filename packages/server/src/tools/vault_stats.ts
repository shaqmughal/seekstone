import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { cachedByGeneration } from '../index/generation.js';

export const VaultStatsInput = z.object({});
export type VaultStatsInput = z.infer<typeof VaultStatsInput>;

export interface VaultStatsResult {
  notes: number;
  /** Distinct parent folders of notes; a note at the vault root has no folder. */
  folders: number;
  /** unique = distinct tags (same as list_tags total); tagged = notes with at least one tag. */
  tags: { unique: number; tagged: number };
  /** Backlink refs to existing notes (removeDoc parks a deleted note's refs), deduped per source→target. */
  links: { resolved: number };
  /** median is the lower middle value for an even count; largest is omitted for an empty vault. */
  bytes: { total: number; median: number; largest?: { path: string; size: number } };
  /** Notes whose mtime is within the last 1, 7 and 30 days of `now`. */
  modified: { d1: number; d7: number; d30: number };
}

const DAY_MS = 86_400_000;

type Snapshot = Omit<VaultStatsResult, 'modified'> & {
  /** Every note's mtime, for the clock-relative `modified` counts. */
  mtimes: Float64Array;
  /** `modified` as counted during the pass, for the `now` the pass ran with. */
  modifiedAt: { now: number; counts: VaultStatsResult['modified'] };
};

/**
 * Counts and sizes for the whole vault, from the warm index only: one pass
 * over ctx.notes plus a sum over ctx.backlinks, no disk reads. That pass is
 * cached per index generation; `modified` depends on the clock, so a cache
 * hit counts it again from the cached mtimes. `now` is
 * injectable so the `modified` windows are testable.
 */
export function vaultStats(ctx: ServerContext, now: number = Date.now()): VaultStatsResult {
  const snap = cachedByGeneration(ctx, 'vault_stats', () => snapshot(ctx, now));
  return {
    notes: snap.notes,
    folders: snap.folders,
    tags: { ...snap.tags },
    links: { ...snap.links },
    bytes: snap.bytes.largest
      ? { ...snap.bytes, largest: { ...snap.bytes.largest } }
      : { ...snap.bytes },
    modified:
      snap.modifiedAt.now === now ? { ...snap.modifiedAt.counts } : modifiedSince(snap.mtimes, now),
  };
}

/** Notes modified within 1, 7 and 30 days of `now`: one pass over the cached mtimes. */
function modifiedSince(mtimes: Float64Array, now: number): VaultStatsResult['modified'] {
  let d1 = 0;
  let d7 = 0;
  let d30 = 0;
  for (const m of mtimes) {
    const age = now - m;
    if (age < 30 * DAY_MS) {
      d30++;
      if (age < 7 * DAY_MS) {
        d7++;
        if (age < DAY_MS) d1++;
      }
    }
  }
  return { d1, d7, d30 };
}

/** The full pass. Counts `modified` for `now` on the way, so a cache miss needs no second loop. */
function snapshot(ctx: ServerContext, now: number): Snapshot {
  const folders = new Set<string>();
  const tags = new Set<string>();
  const sizes = new Float64Array(ctx.notes.size);
  const mtimes = new Float64Array(ctx.notes.size);
  let tagged = 0;
  let total = 0;
  let largest: { path: string; size: number } | undefined;
  let d1 = 0;
  let d7 = 0;
  let d30 = 0;
  let i = 0;

  for (const [path, note] of ctx.notes) {
    const slash = path.lastIndexOf('/');
    if (slash !== -1) folders.add(path.slice(0, slash));

    let hasTag = false;
    for (const tag of note.tags.split(' ')) {
      if (tag === '') continue;
      tags.add(tag);
      hasTag = true;
    }
    if (hasTag) tagged++;

    const age = now - note.mtimeMs;
    if (age < 30 * DAY_MS) {
      d30++;
      if (age < 7 * DAY_MS) {
        d7++;
        if (age < DAY_MS) d1++;
      }
    }

    const size = note.sizeBytes;
    mtimes[i] = note.mtimeMs;
    sizes[i++] = size;
    total += size;
    if (
      largest === undefined ||
      size > largest.size ||
      (size === largest.size && path.localeCompare(largest.path) < 0)
    ) {
      largest = { path, size };
    }
  }

  let resolved = 0;
  for (const refs of ctx.backlinks.values()) resolved += refs.length;

  sizes.sort();
  const bytes: VaultStatsResult['bytes'] = {
    total,
    // Empty vault: index -1 is undefined, so the median falls back to 0.
    median: sizes[(sizes.length - 1) >> 1] ?? 0,
  };
  if (largest !== undefined) bytes.largest = largest;

  return {
    notes: ctx.notes.size,
    folders: folders.size,
    tags: { unique: tags.size, tagged },
    links: { resolved },
    bytes,
    mtimes,
    modifiedAt: { now, counts: { d1, d7, d30 } },
  };
}
