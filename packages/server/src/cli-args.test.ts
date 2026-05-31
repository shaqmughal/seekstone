import { describe, expect, it } from 'vitest';
import { helpText, parseCliIntent } from './cli-args.js';

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
