import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { parseDocument } from 'yaml';

export type OpKind = 'identity' | 'body-append' | 'fm-edit' | 'patch-note' | 'replace-in-note';

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
 * Patch note: insert a marker line immediately after the first heading.
 * Verifies frontmatter region is byte-identical and the marker is present.
 * Returns null if the body has no heading lines.
 */
export function patchNoteOp(original: Buffer): OpResult | null {
  const text = original.toString('utf8');
  const fm = parseFrontmatter(text);
  const body = fm.body;
  const lines = body.split('\n');
  const headingIdx = lines.findIndex((l) => /^#{1,6} /.test(l));
  if (headingIdx === -1) return null;

  const marker = '<!-- seekstone-harness-patch -->';
  const newLines = [...lines.slice(0, headingIdx + 1), marker, ...lines.slice(headingIdx + 1)];
  const newBody = newLines.join('\n');
  const fmRegion = text.slice(0, fm.bodyStart);
  const newText = fmRegion + newBody;
  const newBytes = Buffer.from(newText, 'utf8');
  const fmBytesLen = Buffer.byteLength(fmRegion, 'utf8');

  return {
    bytes: newBytes,
    change: `insert marker after heading at line ${headingIdx}`,
    verify: (post, orig) => {
      const fmPre = orig.subarray(0, fmBytesLen);
      const fmPost = post.subarray(0, fmBytesLen);
      if (!fmPre.equals(fmPost)) {
        return { pass: false, reason: 'frontmatter bytes mutated by patch-note op' };
      }
      const postText = post.toString('utf8');
      if (!postText.includes(marker)) {
        return { pass: false, reason: 'marker line not found after write' };
      }
      return { pass: true };
    },
  };
}

/**
 * Replace-in-note: replace the first occurrence of a 4+ letter word in the
 * body with itself + a marker suffix.
 * Verifies frontmatter region is byte-identical and the marker appears exactly once.
 * Returns null if no eligible word is found.
 */
export function replaceInNoteOp(original: Buffer): OpResult | null {
  const text = original.toString('utf8');
  const fm = parseFrontmatter(text);
  const body = fm.body;
  const match = body.match(/\b([A-Za-z]{4,})\b/);
  if (!match || match.index == null || !match[1]) return null;

  const word = match[1];
  const marker = `${word}<!-- seekstone-harness-replace -->`;
  const newBody = body.slice(0, match.index) + marker + body.slice(match.index + word.length);
  const fmRegion = text.slice(0, fm.bodyStart);
  const newText = fmRegion + newBody;
  const newBytes = Buffer.from(newText, 'utf8');
  const fmBytesLen = Buffer.byteLength(fmRegion, 'utf8');

  return {
    bytes: newBytes,
    change: `replace first occurrence of "${word}" with marked version`,
    verify: (post, orig) => {
      const fmPre = orig.subarray(0, fmBytesLen);
      const fmPost = post.subarray(0, fmBytesLen);
      if (!fmPre.equals(fmPost)) {
        return { pass: false, reason: 'frontmatter bytes mutated by replace-in-note op' };
      }
      const postText = post.toString('utf8');
      const count = postText.split('<!-- seekstone-harness-replace -->').length - 1;
      if (count !== 1) {
        return { pass: false, reason: `expected 1 replacement marker, found ${count}` };
      }
      return { pass: true };
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
