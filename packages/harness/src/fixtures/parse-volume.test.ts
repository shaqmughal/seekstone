import { describe, expect, it } from 'vitest';
import { headwordOf, parseVolume, stripGutenbergBoilerplate } from './parse-volume.js';

// A miniature volume that mirrors the real PG EB1911 structure: START/END
// markers, an "ARTICLES IN THIS SLICE" two-column TOC, alphabetical article
// bodies, and the mid-paragraph lines that a naive splitter would mistake for
// headings (`GABELLE), …`, `IV. the Handsome`, `JOINTS).`, and a paragraph that
// merely opens with an uppercase word).
const SAMPLE = `The Project Gutenberg eBook of Encyclopaedia Britannica, 11th Edition.

This header boilerplate mentions ANJAR and ANNA but must be ignored.

*** START OF THE PROJECT GUTENBERG EBOOK ENCYCLOPAEDIA BRITANNICA, 11TH EDITION, "ANJAR" TO "ANNA" ***

              Anjar to Anna


ARTICLES IN THIS SLICE:


  ANJAR                          ANNA AMALIA
  ANKYLOSIS                      ANNA (Indian penny)
  ANNALISTS                      ANNAPOLIS (Maryland)


ANJAR, a fortified town of India, and the capital of a district of the
same name. The country, GABELLE), is dry and sandy.

ANKYLOSIS, or ANCHYLOSIS (from Gr. ankulos, bent), the fixation of a
joint (see JOINTS).

ANNALISTS (from Lat. annus, year), writers of annals. Henry
IV. the Handsome continued the practice.
ANTIMONY is a word appearing mid-paragraph and must not split.

ANNA AMALIA (1739-1807), duchess of Saxe-Weimar, was a patron of letters.

ANNA (Hindustani _ana_), an Indian penny, the sixteenth part of a rupee.

ANNAPOLIS (Maryland, U.S.A.), the capital of the state, on the Severn.

*** END OF THE PROJECT GUTENBERG EBOOK ENCYCLOPAEDIA BRITANNICA, 11TH EDITION ***

This footer boilerplate must also be ignored.`;

describe('headwordOf', () => {
  it('extracts the leading uppercase headword up to a comma or paren', () => {
    expect(headwordOf('ANJAR, a fortified town')).toBe('ANJAR');
    expect(headwordOf('ANNA AMALIA (1739-1807), duchess')).toBe('ANNA AMALIA');
    expect(headwordOf('ANNA (Hindustani _ana_), a penny')).toBe('ANNA');
    expect(headwordOf('ANTI-MASONIC PARTY')).toBe('ANTI-MASONIC PARTY');
  });

  it('rejects mid-paragraph lines and enumerations', () => {
    expect(headwordOf('ANTIMONY is also used in medicine')).toBeNull(); // lowercase, no early comma
    expect(headwordOf('GABELLE), and comprised sixteen')).toBeNull(); // stray bracket
    expect(headwordOf('IV. the Handsome continued')).toBeNull(); // single-letter numeral
    expect(headwordOf('I. EXTERIOR BALLISTICS')).toBeNull(); // roman-numeral section header
    expect(headwordOf('VII. THEORY OF EQUATIONS')).toBeNull();
    expect(headwordOf('a lowercase opening')).toBeNull();
  });
});

describe('stripGutenbergBoilerplate', () => {
  it('captures the range and drops header/footer', () => {
    const { range, content } = stripGutenbergBoilerplate(SAMPLE);
    expect(range).toBe('ANJAR to ANNA');
    expect(content).not.toContain('header boilerplate');
    expect(content).not.toContain('footer boilerplate');
    expect(content).toContain('ARTICLES IN THIS SLICE');
  });
});

describe('parseVolume', () => {
  const vol = parseVolume(SAMPLE);

  it('reads the TOC headwords', () => {
    expect(vol.tocHeadwords).toEqual(
      expect.arrayContaining([
        'ANJAR',
        'ANKYLOSIS',
        'ANNALISTS',
        'ANNA AMALIA',
        'ANNA',
        'ANNAPOLIS',
      ]),
    );
  });

  it('splits into exactly the TOC-declared articles, in order', () => {
    expect(vol.articles.map((a) => a.title)).toEqual([
      'Anjar',
      'Ankylosis',
      'Annalists',
      'Anna Amalia',
      'Anna',
      'Annapolis',
    ]);
  });

  it('does not split on mid-paragraph uppercase false positives', () => {
    const annalists = vol.articles.find((a) => a.title === 'Annalists');
    expect(annalists).toBeDefined();
    // The `IV. the Handsome` and `ANTIMONY is …` lines belong to this article.
    expect(annalists?.body).toContain('IV. the Handsome');
    expect(annalists?.body).toContain('ANTIMONY is a word');
    // ANTIMONY must not have become its own article.
    expect(vol.articles.some((a) => a.title === 'Antimony')).toBe(false);
  });

  it('keeps full body text and reports byte length', () => {
    const anjar = vol.articles.find((a) => a.title === 'Anjar');
    expect(anjar?.body.startsWith('ANJAR, a fortified town')).toBe(true);
    expect(anjar?.body).toContain('GABELLE)'); // mid-paragraph, stays in body
    expect(anjar?.bytes).toBe(Buffer.byteLength(anjar?.body ?? '', 'utf8'));
  });

  it('parses roughly as many articles as the TOC lists', () => {
    // Sanity invariant we also assert against real volumes in the corpus CLI.
    expect(vol.articles.length).toBe(vol.tocHeadwords.length);
  });
});
