import { parseFrontmatter } from '@seekstone/core/frontmatter';

export type OpKind =
  | 'identity'
  | 'body-append'
  | 'fm-edit'
  | 'patch-note'
  | 'replace-in-note'
  | 'recoverable-delete'
  | 'create-no-clobber'
  | 'cas-conflict';

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
 * Frontmatter edit: add one harness-owned key by pure text insertion before
 * the closing delimiter — no YAML serializer touches the block, so the
 * expected bytes cannot inherit a serializer's own normalizations (the
 * previous doc.toString() construction silently reformatted untouched flow
 * collections, e.g. `["x"]` → `[ "x" ]`, which made a same-serializer
 * corruption invisible — the SHA-281 finding). Verifies:
 *   - body bytes unchanged
 *   - existing frontmatter keys still appear in the same order
 *   - every original frontmatter line not owned by the patched key appears
 *     byte-identically, in order, in the post-write file — so
 *     serializer-induced rewrites of untouched keys (re-quoting, 80-column
 *     scalar folding — the seekstone#233 bug shape) fail the op even though
 *     the YAML still parses to the same data
 *
 * Returns null when there's no well-formed frontmatter to edit, or the note
 * already carries the harness key.
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

  const targetKey = '_seekstone_check';
  // A pre-existing harness key would make the text insertion a duplicate-key
  // edit; never true for real vaults, but bail rather than write bad YAML.
  if (Object.hasOwn(fm.data, targetKey)) return null;

  // Insert the new entry between the last original line and the closing
  // delimiter. Every original byte of the block is carried over verbatim.
  const nl = opensWithCRLF ? '\r\n' : '\n';
  const head = `---${nl}`;
  const rebuilt = `${head}${yamlText}${nl}${targetKey}: ${new Date().toISOString()}${nl}---${nl}${fm.body}`;
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
      // Structural checks first (cheap, and their failures are the clearer
      // diagnosis): all pre-existing keys must survive in the same relative
      // order with nothing else added or dropped.
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
      // Byte-level guarantee: every original FM line that does not belong to
      // the patched key must survive byte-identically and in order. The
      // structural checks above cannot catch a serializer that refolds or
      // re-quotes an untouched value — the YAML parses back to the same data
      // either way (the seekstone#233 blind spot).
      const postYaml = postText.slice(
        openLen,
        postFm.bodyStart - (postText.startsWith('---\r\n') ? 7 : 5),
      );
      const postLines = postYaml.split('\n');
      let cursor = 0;
      for (const line of yamlText.split('\n')) {
        if (line.startsWith(`${targetKey}:`)) continue; // the one line we own
        let found = -1;
        for (let i = cursor; i < postLines.length; i++) {
          if (postLines[i] === line) {
            found = i;
            break;
          }
        }
        if (found === -1) {
          return {
            pass: false,
            reason: `untouched frontmatter line rewritten: ${JSON.stringify(line)}`,
          };
        }
        cursor = found + 1;
      }
      return { pass: true };
    },
  };
}
