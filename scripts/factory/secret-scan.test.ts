import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findFingerprint,
  fingerprintFromEnv,
  listFiles,
  scan,
  TOKEN_CHARS,
} from './secret-scan.mjs';

const SCRIPT = fileURLToPath(new URL('./secret-scan.mjs', import.meta.url));
// Shaped like a Claude Code OAuth token; not a real one.
const TOKEN = `sk-ant-oat01-${'Ab3_x-9'.repeat(14)}AA`;
const sha256 = createHash('sha256').update(TOKEN).digest('hex');
const fp = { sha256, length: TOKEN.length };

describe('findFingerprint', () => {
  it('finds the token on its own, inside JSON and after NAME=', () => {
    expect(findFingerprint(Buffer.from(TOKEN), sha256, TOKEN.length)).toEqual([0]);
    const json = `{"type":"tool_result","content":"${TOKEN}"}`;
    expect(findFingerprint(Buffer.from(json), sha256, TOKEN.length)).toEqual([json.indexOf(TOKEN)]);
    const env = `PATH=/bin\0CLAUDE_CODE_OAUTH_TOKEN=${TOKEN}\0HOME=/home/runner`;
    expect(findFingerprint(Buffer.from(env), sha256, TOKEN.length)).toEqual([env.indexOf(TOKEN)]);
  });

  it('finds the token inside a longer run of token characters', () => {
    const text = `xx/yy+zz=${TOKEN}.more_token_chars~`;
    expect(findFingerprint(Buffer.from(text), sha256, TOKEN.length)).toEqual([9]);
  });

  it('finds every copy, including at the very end of the buffer', () => {
    const text = `${TOKEN} ${TOKEN}`;
    expect(findFingerprint(Buffer.from(text), sha256, TOKEN.length)).toEqual([0, TOKEN.length + 1]);
  });

  it('misses a token that is cut, changed or encoded', () => {
    const cut = TOKEN.slice(0, -1);
    const changed = `${TOKEN.slice(0, -1)}B`;
    const b64 = Buffer.from(TOKEN).toString('base64');
    for (const text of [cut, changed, b64, `${TOKEN.slice(0, 20)}\n${TOKEN.slice(20)}`]) {
      expect(findFingerprint(Buffer.from(text), sha256, TOKEN.length)).toEqual([]);
    }
  });

  it('handles empty and short input', () => {
    expect(findFingerprint(Buffer.alloc(0), sha256, TOKEN.length)).toEqual([]);
    expect(findFingerprint(Buffer.from('abc'), sha256, TOKEN.length)).toEqual([]);
  });
});

describe('findFingerprint with a prefix', () => {
  it('finds the token when it starts with the prefix', () => {
    const text = `xx/${TOKEN}~more`;
    expect(findFingerprint(Buffer.from(text), sha256, TOKEN.length, 'sk-ant-oat01-')).toEqual([3]);
  });

  it('misses it under a prefix it does not start with', () => {
    expect(findFingerprint(Buffer.from(TOKEN), sha256, TOKEN.length, 'sk-ant-api03-')).toEqual([]);
  });

  it('stays fast on a long run of token characters', () => {
    const run = Buffer.alloc(2_000_000, 'A');
    const started = performance.now();
    expect(findFingerprint(run, sha256, TOKEN.length, 'sk-ant-oat01-')).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('TOKEN_CHARS', () => {
  it('accepts an OAuth-shaped token and rejects other characters', () => {
    expect(TOKEN_CHARS.test(TOKEN)).toBe(true);
    for (const bad of ['a b', 'a"b', "a'b", 'a\\b', 'a\nb', 'a`b', ''])
      expect(TOKEN_CHARS.test(bad)).toBe(false);
  });
});

describe('fingerprintFromEnv', () => {
  it('reads a good fingerprint', () => {
    expect(
      fingerprintFromEnv({ SECRET_SHA256: sha256, SECRET_LENGTH: String(TOKEN.length) }),
    ).toEqual({ ...fp, prefix: '' });
    expect(
      fingerprintFromEnv({
        SECRET_SHA256: sha256,
        SECRET_LENGTH: String(TOKEN.length),
        SECRET_PREFIX: 'sk-ant-oat01-',
      }),
    ).toEqual({ ...fp, prefix: 'sk-ant-oat01-' });
  });

  it('refuses a prefix that is not token characters or not shorter than the token', () => {
    const base = { SECRET_SHA256: sha256, SECRET_LENGTH: String(TOKEN.length) };
    expect(fingerprintFromEnv({ ...base, SECRET_PREFIX: 'sk ant' }).error).toBeDefined();
    expect(fingerprintFromEnv({ ...base, SECRET_PREFIX: TOKEN }).error).toBeDefined();
  });

  it('refuses a missing or malformed fingerprint', () => {
    expect(fingerprintFromEnv({}).error).toBeDefined();
    expect(fingerprintFromEnv({ SECRET_SHA256: 'abc', SECRET_LENGTH: '100' }).error).toBeDefined();
    expect(fingerprintFromEnv({ SECRET_SHA256: sha256, SECRET_LENGTH: '' }).error).toBeDefined();
    expect(fingerprintFromEnv({ SECRET_SHA256: sha256, SECRET_LENGTH: '8' }).error).toBeDefined();
  });
});

describe('scanning files', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'secret-scan-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reports the file and offset of a hit, and never the token', () => {
    mkdirSync(join(dir, 'transcript'));
    writeFileSync(join(dir, 'pr.md'), 'Title\n\nBody\n');
    writeFileSync(join(dir, 'transcript', 't.jsonl'), `{"x":"${TOKEN}"}\n`);
    const { hits, problems } = scan([dir], fp);
    expect(problems).toEqual([]);
    expect(hits).toEqual([`${join(dir, 'transcript', 't.jsonl')} at byte 6`]);
    expect(hits.join('')).not.toContain(TOKEN);
  });

  it('scans stdin', () => {
    expect(scan([], { ...fp, stdin: Buffer.from(`commit body ${TOKEN}`) }).hits).toEqual([
      'stdin at byte 12',
    ]);
  });

  it('treats a missing path as empty', () => {
    expect(scan([join(dir, 'none')], fp)).toEqual({ hits: [], problems: [] });
  });

  it('refuses symlinks instead of following them', () => {
    writeFileSync(join(dir, 'real'), TOKEN);
    mkdirSync(join(dir, 'out'));
    symlinkSync(join(dir, 'real'), join(dir, 'out', 'link'));
    const { files, problems } = listFiles(join(dir, 'out'));
    expect(files).toEqual([]);
    expect(problems).toEqual([`${join(dir, 'out', 'link')}: symlink`]);
  });
});

describe('the command', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'secret-scan-cli-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (args: string[], env: Record<string, string>, input = '') => {
    try {
      const out = execFileSync(process.execPath, [SCRIPT, ...args], {
        env: { PATH: process.env.PATH ?? '', ...env },
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (err) {
      const e = err as { status: number; stdout: string; stderr: string };
      return { code: e.status, out: e.stdout + e.stderr };
    }
  };
  const env = { SECRET_SHA256: sha256, SECRET_LENGTH: String(TOKEN.length) };

  it('exits 0 on clean input', () => {
    writeFileSync(join(dir, 'a.md'), 'nothing here');
    expect(run([dir, '-'], env, 'clean objects').code).toBe(0);
  });

  it('exits 1 on a hit, without printing the token', () => {
    const r = run(['-'], env, `x ${TOKEN} y`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('stdin at byte 2');
    expect(r.out).not.toContain(TOKEN);
  });

  it('exits 2 without a fingerprint or anything to scan', () => {
    expect(run([dir], {}).code).toBe(2);
    expect(run([], env).code).toBe(2);
  });
});
