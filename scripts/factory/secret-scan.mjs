#!/usr/bin/env node
// Checks what a factory job is about to publish for the Claude Code token
// (SHA-660).
//
//   node secret-scan.mjs <file-or-dir>... [-]
//
// `-` also scans stdin (the workflow pipes the new git objects in). Exits 0
// when the token isn't found, 1 when it is or when a path can't be checked
// (a symlink or other special file), 2 on bad input.
//
// Env: SECRET_SHA256 and SECRET_LENGTH, the token's SHA-256 (hex) and length
// in bytes, and optionally SECRET_PREFIX, the token's public start (such as
// sk-ant-oat01-). The scan never holds the token, so the step that runs it
// can't leak it. The workflow fingerprints the token in a step before the
// agent starts.
//
// It finds the token as written. An agent that encodes the token first
// (base64, reversed, split) gets past it, so this is a check on accidental
// leaks; keeping the token out of the agent's reach is the real control.
//
// The workflow runs this file from the workflow's own commit, not from the
// checkout the agent worked in, and the file uses only Node built-ins.

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Characters a token may contain. The fingerprint step rejects others. */
export const TOKEN_CHARS = /^[A-Za-z0-9._~+/=-]+$/;

function isTokenByte(b) {
  return (
    (b >= 0x30 && b <= 0x39) || // 0-9
    (b >= 0x41 && b <= 0x5a) || // A-Z
    (b >= 0x61 && b <= 0x7a) || // a-z
    b === 0x2e || // .
    b === 0x5f || // _
    b === 0x7e || // ~
    b === 0x2b || // +
    b === 0x2f || // /
    b === 0x3d || // =
    b === 0x2d // -
  );
}

/**
 * Byte offsets in `buf` where a `length`-byte window hashes to `sha256`.
 * The token can only sit inside a run of token characters, so only windows
 * inside runs at least `length` long are checked. With `prefix` (the public
 * start of the token, such as `sk-ant-oat01-`), only windows that start with
 * it are hashed, which keeps long base64 runs cheap.
 */
export function findFingerprint(buf, sha256, length, prefix = '') {
  const hits = [];
  const pre = Buffer.from(prefix, 'latin1');
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i < buf.length && isTokenByte(buf[i])) continue;
    for (let s = start; s + length <= i; s++) {
      if (pre.length > 0 && buf.compare(pre, 0, pre.length, s, s + pre.length) !== 0) continue;
      const h = createHash('sha256')
        .update(buf.subarray(s, s + length))
        .digest('hex');
      if (h === sha256) hits.push(s);
    }
    start = i + 1;
  }
  return hits;
}

/** Every regular file under `path`. Symlinks and special files are problems. */
export function listFiles(path) {
  const files = [];
  const problems = [];
  const walk = (p) => {
    let st;
    try {
      st = lstatSync(p);
    } catch (err) {
      if (err.code === 'ENOENT') return; // nothing to publish
      problems.push(`${p}: ${err.code ?? err.message}`);
      return;
    }
    if (st.isSymbolicLink()) problems.push(`${p}: symlink`);
    else if (st.isDirectory()) for (const e of readdirSync(p).sort()) walk(join(p, e));
    else if (st.isFile()) files.push(p);
    else problems.push(`${p}: not a regular file`);
  };
  walk(path);
  return { files, problems };
}

/**
 * Scans `paths` (and `stdin`, a Buffer, when given).
 * @returns {{ hits: string[], problems: string[] }} where each hit names a
 *   file (or stdin) and a byte offset, never the bytes there.
 */
export function scan(paths, { sha256, length, prefix = '', stdin }) {
  const hits = [];
  const problems = [];
  const check = (label, buf) => {
    for (const at of findFingerprint(buf, sha256, length, prefix))
      hits.push(`${label} at byte ${at}`);
  };
  for (const p of paths) {
    const listed = listFiles(p);
    problems.push(...listed.problems);
    for (const f of listed.files) check(f, readFileSync(f));
  }
  if (stdin) check('stdin', stdin);
  return { hits, problems };
}

/**
 * A message for a workflow command. File names come from the agent, so a
 * newline in one mustn't start a command of its own.
 */
export function escapeCommand(s) {
  return s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/**
 * The fingerprint from the environment, or an error message. SECRET_PREFIX
 * is optional: the token's public start, which must be shorter than it.
 */
export function fingerprintFromEnv(env) {
  const sha256 = env.SECRET_SHA256 ?? '';
  const length = Number(env.SECRET_LENGTH);
  const prefix = env.SECRET_PREFIX ?? '';
  if (!/^[0-9a-f]{64}$/.test(sha256)) return { error: 'SECRET_SHA256 must be 64 hex digits' };
  if (!Number.isInteger(length) || length < 16)
    return { error: 'SECRET_LENGTH must be 16 or more' };
  if (prefix !== '' && (!TOKEN_CHARS.test(prefix) || prefix.length >= length))
    return { error: 'SECRET_PREFIX must be token characters, shorter than the token' };
  return { sha256, length, prefix };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fp = fingerprintFromEnv(process.env);
  const args = process.argv.slice(2);
  if (fp.error || args.length === 0) {
    console.error(`::error::secret scan: ${fp.error ?? 'nothing to scan'}`);
    process.exit(2);
  }
  const paths = args.filter((a) => a !== '-');
  const stdin = args.includes('-') ? readFileSync(0) : undefined;
  const { hits, problems } = scan(paths, { ...fp, stdin });
  for (const p of problems) console.error(`::error::secret scan can't check ${escapeCommand(p)}`);
  for (const h of hits) console.error(`::error::the Claude Code token is in ${escapeCommand(h)}`);
  if (hits.length || problems.length) process.exit(1);
  console.log(`secret scan: clean (${paths.length + (stdin ? 1 : 0)} input(s))`);
}
