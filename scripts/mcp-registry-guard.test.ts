import { describe, expect, it } from 'vitest';
import { classifyPublishResult } from './mcp-registry-guard.mjs';

const name = 'io.github.shaqmughal/seekstone';
const version = '0.24.0';

// Verbatim from the 2026-11-14 manual Release run (SHA-528).
const duplicate =
  'Error: publish failed: server returned status 400: {"title":"Bad Request","status":400,' +
  '"detail":"Failed to publish server","errors":[{"message":"invalid version: cannot publish ' +
  'duplicate version: io.github.shaqmughal/seekstone@0.24.0 already exists"}]}';

// Verbatim from the 0.19.0 release (npm packument lag).
const npmLag =
  "Error: publish failed: server returned status 400: NPM package 'seekstone' exists, " +
  "but version '0.19.0' was not found (404)";

describe('MCP Registry publish guard', () => {
  it('passes a successful publish', () => {
    expect(classifyPublishResult({ exitCode: 0, output: 'published', name, version })).toEqual({
      ok: true,
    });
  });

  it('passes a duplicate of this exact version, with a warning', () => {
    const r = classifyPublishResult({ exitCode: 1, output: duplicate, name, version });
    expect(r.ok).toBe(true);
    expect(r.warning).toMatch(/already on the MCP Registry/);
  });

  it('fails a duplicate for a different version', () => {
    const r = classifyPublishResult({ exitCode: 1, output: duplicate, name, version: '0.25.0' });
    expect(r).toEqual({ ok: false });
  });

  it('fails a duplicate for a different server name', () => {
    const r = classifyPublishResult({
      exitCode: 1,
      output: duplicate,
      name: 'io.github.someone/else',
      version,
    });
    expect(r).toEqual({ ok: false });
  });

  it('fails the npm-lag 404', () => {
    expect(classifyPublishResult({ exitCode: 1, output: npmLag, name, version })).toEqual({
      ok: false,
    });
  });

  it('fails a validation error', () => {
    const output =
      'Error: publish failed: server returned status 400: {"errors":[{"message":"invalid description"}]}';
    expect(classifyPublishResult({ exitCode: 1, output, name, version })).toEqual({ ok: false });
  });

  it('fails an auth error', () => {
    const output = 'Error: publish failed: server returned status 401: unauthorized';
    expect(classifyPublishResult({ exitCode: 1, output, name, version })).toEqual({ ok: false });
  });

  it('fails when the process was killed (no exit code)', () => {
    expect(classifyPublishResult({ exitCode: null, output: '', name, version })).toEqual({
      ok: false,
    });
  });
});
