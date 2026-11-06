import { walkVault } from '@seekstone/core/walk';
import { isReadable, splitGlobSet, type WritePolicy } from './policy.js';
import { type Period, resolveConfig } from './tools/periodic_note.js';

const PERIODS: Period[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
const SAMPLE = 5;

/**
 * Boot-time warnings for a read scope (SEEKSTONE_READ_PATHS) that interacts
 * with other settings in ways a user probably didn't intend (SHA-291):
 *
 * - D1: existing files match SEEKSTONE_WRITE_PATHS but not the read scope.
 *   They are not writable (write scope = read ∩ write), which is safe, but
 *   the user likely expected to be able to write there.
 * - D4: a configured periodic-note template lies outside the read scope, so
 *   new periodic notes are created without it.
 *
 * Runs after the server is up and never fails boot; returns the messages so
 * the caller logs them and tests can assert on them.
 */
export async function scopeWarnings(vaultRoot: string, policy: WritePolicy): Promise<string[]> {
  if (!policy.readGlobs) return [];
  const warnings: string[] = [];

  if (policy.writeGlobs && !policy.readOnly) {
    const entries = await walkVault(vaultRoot, splitGlobSet(policy.writeGlobs));
    const blocked = entries.map((e) => e.relPath).filter((p) => !isReadable(policy, p));
    if (blocked.length > 0) {
      warnings.push(
        `${blocked.length} file(s) match SEEKSTONE_WRITE_PATHS but are outside SEEKSTONE_READ_PATHS, so they are not writable (e.g. ${blocked
          .slice(0, SAMPLE)
          .join(', ')}).`,
      );
    }
  }

  for (const period of PERIODS) {
    const cfg = await resolveConfig(vaultRoot, period);
    if (!cfg.template) continue;
    const template = cfg.template.endsWith('.md') ? cfg.template : `${cfg.template}.md`;
    if (!isReadable(policy, template)) {
      warnings.push(
        `The ${period} note template "${template}" is outside SEEKSTONE_READ_PATHS; new ${period} notes are created without it.`,
      );
    }
  }
  return warnings;
}
