import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from './frontmatter.js';

// Fixed seed keeps CI deterministic (repo convention — same reason the
// fixture vault pins seed 42). Bump numRuns locally when hunting.
fc.configureGlobal({ seed: 42, numRuns: 200 });

/** Plain string→string mapping with yaml-friendly keys; values are arbitrary
 * unicode so quoting, escaping, and scalar folding all get exercised. */
const fmObject = fc.dictionary(fc.stringMatching(/^[a-z][a-zA-Z0-9_-]{0,15}$/), fc.string(), {
  minKeys: 1,
  maxKeys: 8,
});

/** A note built from a known frontmatter object and a known body. */
const constructedNote = fc.tuple(fmObject, fc.string()).map(([data, body]) => ({
  data,
  body,
  text: `---\n${stringifyYaml(data)}---\n${body}`,
}));

describe('parseFrontmatter properties', () => {
  it('is total and self-consistent on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const r = parseFrontmatter(text);
        // bodyStart 0 always means "the whole file is the body".
        if (r.bodyStart === 0) expect(r.body).toBe(text);
        // Otherwise the offset must reconstruct the input exactly — this is
        // the invariant byte-faithful writers depend on.
        else expect(text.slice(0, r.bodyStart) + r.body).toBe(text);
        if (!r.present) {
          expect(r.data).toBeNull();
          expect(r.malformed).toBe(false);
          expect(r.bodyStart).toBe(0);
        }
        expect(r.keys).toEqual(r.data ? Object.keys(r.data) : []);
        if (r.data !== null) expect(r.malformed).toBe(false);
      }),
    );
  });

  it('round-trips a constructed frontmatter block', () => {
    fc.assert(
      fc.property(constructedNote, ({ data, body, text }) => {
        const r = parseFrontmatter(text);
        expect(r.present).toBe(true);
        expect(r.malformed).toBe(false);
        expect(r.data).toEqual(data);
        expect(r.body).toBe(body);
        expect(text.slice(r.bodyStart)).toBe(body);
      }),
    );
  });

  it('keeps the frontmatter region stable under body append (write-safety contract)', () => {
    fc.assert(
      fc.property(constructedNote, fc.string({ minLength: 1 }), ({ text }, marker) => {
        const before = parseFrontmatter(text);
        const after = parseFrontmatter(text + marker);
        expect(after.bodyStart).toBe(before.bodyStart);
        expect((text + marker).slice(0, after.bodyStart)).toBe(text.slice(0, before.bodyStart));
        expect(after.body).toBe(before.body + marker);
        expect(after.keys).toEqual(before.keys);
      }),
    );
  });

  it('treats an unterminated block as malformed with the whole file as body', () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter((s) => !`\n${s}`.includes('\n---\n') && !`\r\n${s}`.includes('\r\n---\r\n')),
        (rest) => {
          const text = `---\n${rest}`;
          const r = parseFrontmatter(text);
          expect(r.present).toBe(true);
          expect(r.malformed).toBe(true);
          expect(r.bodyStart).toBe(0);
          expect(r.body).toBe(text);
        },
      ),
    );
  });
});
