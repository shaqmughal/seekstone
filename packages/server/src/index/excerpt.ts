/**
 * Extract a short excerpt centred on the first occurrence of any query term.
 * Returns at most `maxLen` characters with leading/trailing ellipsis as needed.
 *
 * This is the core context-tax reduction: instead of returning the full note
 * (~7 KB mean, ~70 KB p99), we return ~200 chars of relevant context.
 */
export function extractExcerpt(text: string, terms: string[], maxLen = 200): string {
  const lower = text.toLowerCase();
  let bestIdx = -1;

  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }

  if (bestIdx === -1) {
    // No term found in body (hit may have been in title/tags) — return the start.
    return truncate(text.trimStart(), maxLen);
  }

  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, bestIdx - half);
  const end = Math.min(text.length, bestIdx + half + terms[0]!.length);
  const slice = text.slice(start, end).trim();

  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}
