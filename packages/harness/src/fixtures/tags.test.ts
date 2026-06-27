import { describe, expect, it } from 'vitest';
import { buildTagVocab, TAG_VOCAB } from './tags.js';

describe('TAG_VOCAB', () => {
  it('is non-empty and has no duplicates', () => {
    expect(TAG_VOCAB.length).toBeGreaterThan(0);
    expect(new Set(TAG_VOCAB).size).toBe(TAG_VOCAB.length);
  });

  it('leads with the broad head subjects', () => {
    expect(TAG_VOCAB[0]).toBe('history');
    expect(TAG_VOCAB.slice(0, 3)).toEqual(['history', 'science', 'geography']);
  });
});

describe('buildTagVocab', () => {
  it('returns exactly `target` tags when the target exceeds the base vocab', () => {
    const v = buildTagVocab(320);
    expect(v).toHaveLength(320);
  });

  it('produces no duplicates even after padding the tail', () => {
    const v = buildTagVocab(320);
    expect(new Set(v).size).toBe(v.length);
  });

  it('preserves the base vocab as a stable prefix (head stays broad)', () => {
    const v = buildTagVocab(320);
    expect(v.slice(0, TAG_VOCAB.length)).toEqual(TAG_VOCAB);
  });

  it('is deterministic across calls', () => {
    expect(buildTagVocab(200)).toEqual(buildTagVocab(200));
  });

  it('truncates to the base vocab when the target is smaller than it', () => {
    const v = buildTagVocab(5);
    expect(v).toEqual(TAG_VOCAB.slice(0, 5));
  });

  it('defaults to a 320-tag vocabulary', () => {
    expect(buildTagVocab()).toHaveLength(320);
  });
});
