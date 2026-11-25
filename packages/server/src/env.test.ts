import { describe, expect, it } from 'vitest';
import { envFlag, flagWarnings, normalizeEnv } from './env.js';
import { parseWritePolicy } from './policy.js';

describe('envFlag', () => {
  it.each(['1', 'true', 'yes', 'on', 'TRUE', 'Yes', ' on ', '\tOn\n'])('%j is on', (v) => {
    expect(envFlag(v, false)).toBe(true);
  });
  it.each(['0', 'false', 'no', 'off', 'FALSE', 'No', ' off ', '\tOFF\n'])('%j is off', (v) => {
    expect(envFlag(v, true)).toBe(false);
  });
  it.each([undefined, '', '  ', '2', 'y', 'enabled', 'truee'])('%j falls back', (v) => {
    expect(envFlag(v, true)).toBe(true);
    expect(envFlag(v, false)).toBe(false);
  });
});

/** An unfilled MCPB placeholder: the literal text `${user_config.<key>}`. */
const ph = (key: string): string => `\${user_config.${key}}`;

describe('normalizeEnv', () => {
  it('drops the read_paths placeholder with one warning, leaving no read scope', () => {
    const env: Record<string, string | undefined> = {
      SEEKSTONE_READ_PATHS: ph('read_paths'),
    };
    expect(env.SEEKSTONE_READ_PATHS).toBe('$' + '{user_config.read_paths}');
    const warnings = normalizeEnv(env);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('SEEKSTONE_READ_PATHS');
    expect('SEEKSTONE_READ_PATHS' in env).toBe(false);
    expect(parseWritePolicy(env).readGlobs).toBeUndefined();
  });

  it('warns once per dropped variable', () => {
    const env: Record<string, string | undefined> = {
      SEEKSTONE_READ_ONLY: ph('read_only'),
      SEEKSTONE_LOG_FILE: ph('log_file'),
      SEEKSTONE_VAULT: '/notes',
    };
    const warnings = normalizeEnv(env);
    expect(warnings).toHaveLength(2);
    expect(warnings.filter((w) => w.includes('SEEKSTONE_READ_ONLY'))).toHaveLength(1);
    expect(warnings.filter((w) => w.includes('SEEKSTONE_LOG_FILE'))).toHaveLength(1);
    expect(env).toEqual({ SEEKSTONE_VAULT: '/notes' });
  });

  it('keeps blank and real values, and leaves non-SEEKSTONE variables alone', () => {
    const env: Record<string, string | undefined> = {
      SEEKSTONE_WRITE_PATHS: '',
      SEEKSTONE_HISTORY: 'false',
      SEEKSTONE_INSTRUCTIONS: `notes/${ph('instructions')}`,
      SEEKSTONE_LOG_LEVEL: ` ${ph('log_level')}`,
      OTHER: ph('other'),
    };
    const before = { ...env };
    expect(normalizeEnv(env)).toEqual([]);
    expect(env).toEqual(before);
  });
});

describe('flagWarnings', () => {
  it('warns once per unrecognized on/off value and names the default', () => {
    const warnings = flagWarnings({
      SEEKSTONE_READ_ONLY: 'y',
      SEEKSTONE_HISTORY: 'enabled',
      SEEKSTONE_WATCH_POLL: '2',
      SEEKSTONE_SEMANTIC: 'truee',
    });
    expect(warnings).toEqual([
      expect.stringMatching(/^SEEKSTONE_READ_ONLY="y" .*using the default, off$/),
      expect.stringMatching(/^SEEKSTONE_HISTORY="enabled" .*using the default, on$/),
      expect.stringMatching(/^SEEKSTONE_WATCH_POLL="2" .*using the default, off$/),
      expect.stringMatching(/^SEEKSTONE_SEMANTIC="truee" .*using the default, off$/),
    ]);
  });

  it.each([undefined, '', '  ', '1', 'TRUE', ' off ', 'No'])('%j does not warn', (v) => {
    expect(
      flagWarnings({
        SEEKSTONE_READ_ONLY: v,
        SEEKSTONE_HISTORY: v,
        SEEKSTONE_WATCH_POLL: v,
        SEEKSTONE_SEMANTIC: v,
      }),
    ).toEqual([]);
  });

  it('ignores settings that are not on/off flags', () => {
    expect(flagWarnings({ SEEKSTONE_LOG_LEVEL: 'loud', SEEKSTONE_VAULT: 'y' })).toEqual([]);
  });
});
