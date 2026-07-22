import { describe, expect, it } from 'vitest';
import { helpText, initHelpText, parseCliIntent } from './cli-args.js';

describe('parseCliIntent', () => {
  it('returns "run" with no args', () => {
    expect(parseCliIntent([])).toBe('run');
  });

  it('recognizes --version and -v', () => {
    expect(parseCliIntent(['--version'])).toBe('version');
    expect(parseCliIntent(['-v'])).toBe('version');
  });

  it('recognizes --help and -h', () => {
    expect(parseCliIntent(['--help'])).toBe('help');
    expect(parseCliIntent(['-h'])).toBe('help');
  });

  it('version takes precedence when it appears first', () => {
    expect(parseCliIntent(['--version', '--help'])).toBe('version');
    expect(parseCliIntent(['--help', '--version'])).toBe('help');
  });

  it('ignores unrelated args', () => {
    expect(parseCliIntent(['--vault', '/x'])).toBe('run');
  });

  it('recognizes the init subcommand', () => {
    expect(parseCliIntent(['init'])).toBe('init');
    expect(parseCliIntent(['init', '--vault', '/x', '--write'])).toBe('init');
  });

  it('init --help / init -h ask for init help, not the init run path', () => {
    expect(parseCliIntent(['init', '--help'])).toBe('init-help');
    expect(parseCliIntent(['init', '-h'])).toBe('init-help');
    expect(parseCliIntent(['init', '--vault', '/x', '--help'])).toBe('init-help');
  });
});

describe('helpText', () => {
  it('includes the version and the key env var', () => {
    const text = helpText('1.2.3');
    expect(text).toContain('seekstone 1.2.3');
    expect(text).toContain('SEEKSTONE_VAULT');
    expect(text).toContain('claude mcp add seekstone');
  });

  it('documents the init subcommand', () => {
    expect(helpText('1.2.3')).toContain('seekstone init');
  });
});

describe('initHelpText', () => {
  it('includes the version and every init flag', () => {
    const text = initHelpText('1.2.3');
    expect(text).toContain('seekstone 1.2.3');
    expect(text).toContain('seekstone init');
    expect(text).toContain('--vault');
    expect(text).toContain('--client');
    expect(text).toContain('--write');
  });
});
