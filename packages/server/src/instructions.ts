import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Logger } from './log.js';

const MAX_BYTES = 16 * 1024;

function truncateUtf8(text: string, maxBytes: number): string {
  let bytes = 0;
  let out = '';
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (bytes + chBytes > maxBytes) break;
    out += ch;
    bytes += chBytes;
  }
  return out;
}

export function resolveInstructions(
  env: Record<string, string | undefined>,
  vaultRoot: string,
  log: Pick<Logger, 'warn' | 'info'>,
): string | undefined {
  const raw = (env.SEEKSTONE_INSTRUCTIONS ?? '').trim();
  if (raw === '') return undefined;
  const path = isAbsolute(raw) ? raw : resolve(vaultRoot, raw);

  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch (err) {
    log.warn('cannot read SEEKSTONE_INSTRUCTIONS file; starting without instructions', {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }

  let trimmed = content.trim();
  if (trimmed === '') return undefined;

  const bytes = Buffer.byteLength(trimmed, 'utf8');
  if (bytes > MAX_BYTES) {
    log.warn('SEEKSTONE_INSTRUCTIONS file exceeds 16 KB; truncated', { path, bytes });
    trimmed = truncateUtf8(trimmed, MAX_BYTES).trim();
    if (trimmed === '') return undefined;
  }

  log.info('instructions attached', { bytes: Buffer.byteLength(trimmed, 'utf8') });
  return trimmed;
}
