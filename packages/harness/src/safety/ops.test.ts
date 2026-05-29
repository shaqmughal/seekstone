import { describe, expect, it } from 'vitest';
import { bodyAppendOp, fmEditOp, identityOp } from './ops.js';

const sampleNote = `---
title: Hello World
tags:
  - alpha
  - beta
date: 2026-05-28
aliases: ["greeting"]
---
# Hello

Body line one.
Body line two.
`;

describe('identityOp', () => {
  it('produces bytes equal to original and verifies pass on identical post', () => {
    const orig = Buffer.from(sampleNote, 'utf8');
    const op = identityOp(orig);
    expect(op.bytes.equals(orig)).toBe(true);
    expect(op.verify(orig, orig).pass).toBe(true);
  });

  it('fails verify if a single byte drifts', () => {
    const orig = Buffer.from(sampleNote, 'utf8');
    const op = identityOp(orig);
    const drifted = Buffer.from(orig);
    drifted[drifted.length - 1] = 0x20; // change trailing newline to space
    expect(op.verify(drifted, orig).pass).toBe(false);
  });
});

describe('bodyAppendOp', () => {
  it('appends marker only to body; frontmatter region untouched', () => {
    const orig = Buffer.from(sampleNote, 'utf8');
    const op = bodyAppendOp(orig, '\nAPPENDED\n');
    const expected = Buffer.concat([orig, Buffer.from('\nAPPENDED\n', 'utf8')]);
    expect(op.bytes.equals(expected)).toBe(true);
    expect(op.verify(expected, orig).pass).toBe(true);
  });

  it('detects frontmatter mutation in post', () => {
    const orig = Buffer.from(sampleNote, 'utf8');
    const op = bodyAppendOp(orig, '\nAPPENDED\n');
    const tampered = Buffer.from(
      op.bytes.toString('utf8').replace('Hello World', 'Howdy World'),
      'utf8',
    );
    const r = op.verify(tampered, orig);
    expect(r.pass).toBe(false);
  });
});

describe('fmEditOp', () => {
  it('preserves body bytes and existing key order after a fm edit', () => {
    const orig = Buffer.from(sampleNote, 'utf8');
    const op = fmEditOp(orig);
    expect(op).not.toBeNull();
    if (!op) return;
    // Simulate post-write: the harness would write op.bytes via the adapter,
    // and re-read from disk. Round-trip == op.bytes itself for a faithful writer.
    const r = op.verify(op.bytes, orig);
    expect(r.pass).toBe(true);
  });

  it('returns null for notes without frontmatter', () => {
    const orig = Buffer.from('# Just body\nNo FM here.\n', 'utf8');
    expect(fmEditOp(orig)).toBeNull();
  });
});
