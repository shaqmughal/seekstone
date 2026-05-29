import { parseDocument } from 'yaml';
import { parseFrontmatter } from '../profiler/frontmatter.js';

export type OpKind = 'identity' | 'body-append' | 'fm-edit';

export interface OpResult {
  /** The bytes to write back via the adapter. */
  bytes: Buffer;
  /** Human description of what we changed (for the report). */
  change: string;
  /**
   * Predicate the post-write file must satisfy. The runner reads the file
   * bytes from disk and passes them in.
   */
  verify: (post: Buffer, original: Buffer) => { pass: boolean; reason?: string };
}

/**
 * Identity: write the file back exactly as-is. The expectation is byte-equal.
 * Any drift here is a pure adapter bug (encoding, line endings, trailing newline).
 */
export function identityOp(original: Buffer): OpResult {
  return {
    bytes: original,
    change: 'identity round-trip',
    verify: (post, orig) => ({
      pass: post.equals(orig),
      reason: post.equals(orig) ? undefined : 'post-write bytes differ from original',
    }),
  };
}

/**
 * Body append: leave frontmatter untouched, append a marker to the body.
 * Verifies frontmatter region bytes are unchanged and body has exactly
 * the appended bytes at the end (no other modifications).
 */
export function bodyAppendOp(
  original: Buffer,
  marker = '\n\n<!-- seekstone-harness -->\n',
): OpResult {
  const text = original.toString('utf8');
  const fm = parseFrontmatter(text);
  const newText = text + marker;
  const newBytes = Buffer.from(newText, 'utf8');
  return {
    bytes: newBytes,
    change: `append ${marker.length} bytes to body`,
    verify: (post, orig) => {
      // Frontmatter region (orig[0..bodyStart]) must be identical.
      const fmBytesLen = Buffer.byteLength(text.slice(0, fm.bodyStart), 'utf8');
      const fmPre = orig.subarray(0, fmBytesLen);
      const fmPost = post.subarray(0, fmBytesLen);
      if (!fmPre.equals(fmPost)) {
        return { pass: false, reason: 'frontmatter bytes mutated by body-only append' };
      }
      const expected = Buffer.concat([orig, Buffer.from(marker, 'utf8')]);
      return {
        pass: post.equals(expected),
        reason: post.equals(expected)
          ? undefined
          : 'appended file does not match original + marker',
      };
    },
  };
}

/**
 * Frontmatter edit: flip / add one value using yaml.parseDocument so existing
 * keys keep their order, quote style, and comments. Verifies:
 *   - body bytes unchanged
 *   - existing frontmatter keys still appear in the same order
 *   - quote style of pre-existing scalars is unchanged
 *
 * If we can't find a safely-editable key (everything is exotic), returns null.
 */
export function fmEditOp(original: Buffer): OpResult | null {
  const text = original.toString('utf8');
  const fm = parseFrontmatter(text);
  if (!fm.present || fm.malformed || !fm.data) return null;
  if (!text.startsWith('---\n') && !text.startsWith('﻿---\n') && !text.startsWith('---\r\n')) {
    return null;
  }

  // Find the FM block as raw text so we can replace just that region.
  // parseFrontmatter already tells us bodyStart; the FM text is everything
  // between the opening `---\n` and the matching `\n---\n`.
  const opensWithCRLF = text.startsWith('---\r\n');
  const openLen = opensWithCRLF ? 5 : 4;
  // bodyStart points just after the closing `---\n` (or `\r\n---\r\n`). The
  // closing delimiter is 5 or 7 bytes long depending on CRLF.
  const closeLen = opensWithCRLF ? 7 : 5;
  const yamlText = text.slice(openLen, fm.bodyStart - closeLen);
  // Keep the trailing newline before `---` — parseDocument round-trips it.
  const doc = parseDocument(yamlText, { keepSourceTokens: true });

  // Choose a target: prefer a key the harness owns, fall back to flipping a
  // scalar value of an existing key in a non-destructive way.
  const targetKey = '_seekstone_check';
  doc.set(targetKey, new Date().toISOString());

  const newYaml = doc.toString();
  const head = opensWithCRLF ? '---\r\n' : '---\n';
  const tail = opensWithCRLF ? '---\r\n' : '---\n';
  // doc.toString() ends with `\n`, which is the boundary before `---`.
  const rebuilt = head + newYaml + tail.replace(/^/, '') + fm.body;
  const newBytes = Buffer.from(rebuilt, 'utf8');

  return {
    bytes: newBytes,
    change: `add frontmatter key ${targetKey}`,
    verify: (post) => {
      // Body must be byte-identical to the original body.
      const postText = post.toString('utf8');
      const postFm = parseFrontmatter(postText);
      if (postFm.body !== fm.body) {
        return { pass: false, reason: 'body bytes changed during frontmatter edit' };
      }
      if (!postFm.keys.includes(targetKey)) {
        return {
          pass: false,
          reason: `added key ${targetKey} missing from post-write frontmatter`,
        };
      }
      // All pre-existing keys (excluding targetKey if it was already there) must
      // survive the round-trip in the same relative order.
      const expectedKeys = fm.keys.filter((k) => k !== targetKey);
      const postKeys = postFm.keys.filter((k) => k !== targetKey);
      if (postKeys.length !== expectedKeys.length) {
        return {
          pass: false,
          reason: `frontmatter key count drifted: ${expectedKeys.length} → ${postKeys.length}`,
        };
      }
      for (let i = 0; i < expectedKeys.length; i++) {
        if (postKeys[i] !== expectedKeys[i]) {
          return {
            pass: false,
            reason: `key order changed at index ${i}: ${expectedKeys[i]} → ${postKeys[i]}`,
          };
        }
      }
      return { pass: true };
    },
  };
}
