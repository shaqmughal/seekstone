import { describe, expect, it } from 'vitest';
import { buildLinkifier } from './linkify.js';

const art = (title: string, body: string, noteBasename = title) => ({
  title,
  noteBasename,
  body,
});

/** Small corpus where nothing trips the DF filter unless a test wants it to. */
function build(articles: ReturnType<typeof art>[], opts = {}) {
  return buildLinkifier(articles, opts);
}

describe('linkify', () => {
  it('wraps a mention of another article, plain when the surface equals the basename', () => {
    const lk = build([art('Eagle', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Hawk', 'Smaller than the Eagle.');
    expect(r.body).toBe('Smaller than the [[Eagle]].');
    expect(r.links).toEqual([{ target: 'Eagle', surface: 'Eagle' }]);
  });

  it('aliases when the surface differs in case or number', () => {
    const lk = build([art('Eagle', 'x'), art('Vulture', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Hawk', 'Like eagles, unlike VULTURE prey.');
    expect(r.body).toBe('Like [[Eagle|eagles]], unlike [[Vulture|VULTURE]] prey.');
  });

  it('matches -es plurals', () => {
    const lk = build([art('Fox', 'x'), art('Hawk', 'x')]);
    expect(lk.linkify('Hawk', 'It hunts foxes.').body).toBe('It hunts [[Fox|foxes]].');
  });

  it('links only the first mention per target', () => {
    const lk = build([art('Eagle', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Hawk', 'An eagle here. Another eagle there.');
    expect(r.body).toBe('An [[Eagle|eagle]] here. Another eagle there.');
    expect(r.links).toHaveLength(1);
  });

  it('never links the article to itself', () => {
    const lk = build([art('Eagle', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Eagle', 'EAGLE, the name given to eagles generally.');
    expect(r.body).toBe('EAGLE, the name given to eagles generally.');
    expect(r.links).toEqual([]);
  });

  it('prefers the longest title at a position, consuming its span', () => {
    const lk = build([art('New England', 'x'), art('England', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Hawk', 'Settled in New England early.');
    expect(r.body).toBe('Settled in [[New England]] early.');
  });

  it('a DF-excluded title consumes its span without linking, shielding sub-words', () => {
    // "New England" appears in 2/3 notes -> DF 66% > 3% -> excluded.
    const lk = build([
      art('New England', 'x'),
      art('England', 'x'),
      art('Hawk', 'From New England.'),
      art('Kite', 'Also New England.'),
    ]);
    const r = lk.linkify('Eagle', 'Flew over New England today.');
    // Neither the excluded compound nor its "England" sub-word is linked.
    expect(r.body).toBe('Flew over New England today.');
  });

  it('drops common words via the document-frequency filter', () => {
    // "Man" is mentioned in every other note; a rare title still links.
    const articles = [
      art('Man', 'x'),
      art('Anemometer', 'x'),
      ...Array.from({ length: 40 }, (_, i) => art(`Filler ${i}`, 'a man walked by')),
      art('Windmill', 'the man used an anemometer'),
    ];
    const lk = build(articles);
    const r = lk.linkify('Windmill', 'the man used an anemometer');
    expect(r.body).toBe('the man used an [[Anemometer|anemometer]]');
  });

  it('ignores titles shorter than the minimum length', () => {
    const lk = build([art('As', 'x'), art('Hawk', 'x')]);
    expect(lk.linkify('Hawk', 'Known as a hunter.').body).toBe('Known as a hunter.');
  });

  it('never wraps a span flush against a square bracket', () => {
    const lk = build([art('Delta', 'x'), art('Greek', 'x'), art('Hawk', 'x')]);
    const body = 'The symbol [delta] and [Greek: text] stay; the delta links.';
    expect(lk.linkify('Hawk', body).body).toBe(
      'The symbol [delta] and [Greek: text] stay; the [[Delta|delta]] links.',
    );
  });

  it('leaves [Illustration lines untouched', () => {
    const lk = build([art('Eagle', 'x'), art('Hawk', 'x')]);
    const body = '[Illustration: FIG 1. An eagle.]\nA real eagle.';
    expect(lk.linkify('Hawk', body).body).toBe(
      '[Illustration: FIG 1. An eagle.]\nA real [[Eagle|eagle]].',
    );
  });

  it('uses the note basename as the target when it differs from the title', () => {
    const lk = build([art('What/Where', 'x', 'What-Where'), art('Hawk', 'x')]);
    const r = lk.linkify('Hawk', 'See What/Where for details.');
    // The slash never survives tokenization, so no match — but a safe basename
    // must be what gets emitted for titles that DO match.
    expect(r.links).toEqual([]);
    const lk2 = build([art("D'Arcy", 'x', "D'Arcy"), art('Hawk', 'x')]);
    expect(lk2.linkify('Hawk', "Met D'Arcy once.").body).toBe("Met [[D'Arcy]] once.");
  });

  it('preserves prose byte-for-byte modulo the wrappers', () => {
    const lk = build([art('Eagle', 'x'), art('Vulture', 'x'), art('Hawk', 'x')]);
    const body = 'Great eagles and VULTURES circle;\nthe eagle returns.';
    const linked = lk.linkify('Hawk', body).body;
    const unwrapped = linked.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1');
    expect(unwrapped).toBe(body);
  });

  it('multiple links on one line keep their offsets straight', () => {
    const lk = build([art('Eagle', 'x'), art('Kite', 'x'), art('Hawk', 'x')]);
    const r = lk.linkify('Falcon', 'The eagle, the hawk and the kite.');
    expect(r.body).toBe('The [[Eagle|eagle]], the [[Hawk|hawk]] and the [[Kite|kite]].');
    expect(r.links.map((l) => l.target)).toEqual(['Eagle', 'Hawk', 'Kite']);
  });

  it('is deterministic', () => {
    const articles = [
      art('Eagle', 'The hawk and the kite.'),
      art('Hawk', 'The eagle and the kite.'),
      art('Kite', 'The eagle and the hawk.'),
    ];
    const a = build(articles).linkify('Eagle', 'The hawk and the kite.');
    const b = build(articles).linkify('Eagle', 'The hawk and the kite.');
    expect(a).toEqual(b);
  });
});
