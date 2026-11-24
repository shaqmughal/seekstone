/**
 * Environment helpers shared by every setting the server reads at boot.
 *
 * A `.mcpb` install passes Claude Desktop's extension settings through
 * `${user_config.<key>}` placeholders. The MCPB toolchain leaves a placeholder
 * as literal text when a field has no value, so a blank field could reach us
 * as `SEEKSTONE_READ_PATHS=${user_config.read_paths}`, which would scope the
 * vault to a glob that matches nothing. `normalizeEnv` drops those values so
 * a blank field behaves like an unset variable (SHA-633).
 */

const PLACEHOLDER = /^\$\{user_config\.[^}]*\}$/;

/**
 * Delete every `SEEKSTONE_*` value that is exactly an unreplaced
 * `${user_config.<key>}` placeholder. Runs before the logger exists (the
 * logger reads `SEEKSTONE_LOG_*`), so it returns one warning per dropped
 * variable for the caller to log.
 */
export function normalizeEnv(env: Record<string, string | undefined>): string[] {
  const warnings: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('SEEKSTONE_') || value === undefined || !PLACEHOLDER.test(value)) {
      continue;
    }
    delete env[name];
    warnings.push(`${name} was the unfilled placeholder ${value}; treating it as unset`);
  }
  return warnings;
}

const ON = new Set(['1', 'true', 'yes', 'on']);
const OFF = new Set(['0', 'false', 'no', 'off']);

/**
 * Parse an on/off setting. `1/true/yes/on` is on and `0/false/no/off` is off,
 * in any case and with surrounding spaces; anything else, blank included,
 * returns `fallback`.
 */
export function envFlag(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (ON.has(v)) return true;
  if (OFF.has(v)) return false;
  return fallback;
}
