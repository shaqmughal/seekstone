import { describe, expect, it } from 'vitest';
import { MAX_SHARD_BYTES, shard } from './shard.mjs';

describe('shard', () => {
  it('round-trips: concatenated shards equal the original bytes', () => {
    const buf = Buffer.from('seekstone'.repeat(50_000)); // ~450KB
    const parts = shard(buf, 95 * 1024);
    expect(Buffer.concat(parts).equals(buf)).toBe(true);
  });

  it('keeps every shard at or under the cap', () => {
    const buf = Buffer.alloc(1_700_000, 7);
    const max = 95 * 1024;
    for (const part of shard(buf, max)) expect(part.length).toBeLessThanOrEqual(max);
  });

  it('produces the expected number of shards', () => {
    const buf = Buffer.alloc(250, 1);
    expect(shard(buf, 100)).toHaveLength(3); // 100 + 100 + 50
  });

  it('returns a single shard when the buffer fits', () => {
    const buf = Buffer.from('small');
    expect(shard(buf, MAX_SHARD_BYTES)).toHaveLength(1);
  });

  it('returns no shards for an empty buffer', () => {
    expect(shard(Buffer.alloc(0))).toHaveLength(0);
  });

  it('rejects a non-positive max', () => {
    expect(() => shard(Buffer.from('x'), 0)).toThrow(/positive/);
  });
});
