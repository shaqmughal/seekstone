import { get_encoding } from 'tiktoken';
import { describe, expect, it } from 'vitest';
import { runN, runNStream, timed } from './timer.js';

const enc = get_encoding('cl100k_base');

describe('timed', () => {
  it('returns the result of the fn unchanged', async () => {
    const result = await timed(async () => ({ value: 42, label: 'hello' }));
    expect(result.result).toEqual({ value: 42, label: 'hello' });
  });

  it('durationMs is a non-negative number', async () => {
    const result = await timed(async () => 'x');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('durationMs is >= 0 for a fn that resolves immediately', async () => {
    const result = await timed(async () => null);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

const simpleFn = async () => ({ result: 'x', payloadBytes: 100 });

describe('runN', () => {
  it('with runs=3, returns cold (first run ms), warm.n=2, all.n=3', async () => {
    const stats = await runN(simpleFn, 3);
    expect(typeof stats.coldMs).toBe('number');
    expect(stats.coldMs).toBeGreaterThanOrEqual(0);
    expect(stats.warm.n).toBe(2);
    expect(stats.all.n).toBe(3);
  });

  it('payloadBytesMean is the average of the payloadBytes returned by fn', async () => {
    let call = 0;
    const varying = async () => {
      call += 1;
      // runs return 100, 200, 300 → mean = 200
      return { result: 'y', payloadBytes: call * 100 };
    };
    const stats = await runN(varying, 3);
    expect(stats.payloadBytesMean).toBeCloseTo(200, 5);
  });

  it('falls back to ceil(payloadBytesMean / 4) when no payloadText is provided', async () => {
    const stats = await runN(simpleFn, 3);
    expect(stats.payloadTokensMean).toBe(Math.ceil(stats.payloadBytesMean / 4));
  });

  it('uses tiktoken cl100k_base when payloadText is provided', async () => {
    const text = 'Hello, this is a sample note with some content for token counting.';
    const fn = async () => ({
      result: 'x',
      payloadBytes: Buffer.byteLength(text, 'utf8'),
      payloadText: text,
    });
    const stats = await runN(fn, 3);
    const expected = enc.encode(text).length;
    expect(stats.payloadTokensMean).toBe(expected);
    // Tiktoken count should differ from the bytes÷4 estimate for this text.
    expect(stats.payloadTokensMean).not.toBe(Math.ceil(stats.payloadBytesMean / 4));
  });

  it('runs field equals the argument passed', async () => {
    const stats = await runN(simpleFn, 7);
    expect(stats.runs).toBe(7);
  });

  it('with runs=1, warm.n=0 (warm = runs 2..N, nothing there)', async () => {
    const stats = await runN(simpleFn, 1);
    expect(stats.warm.n).toBe(0);
    expect(stats.all.n).toBe(1);
    expect(stats.coldMs).toBeGreaterThanOrEqual(0);
  });

  it('with runs=1, payloadBytesMean equals the single payload returned', async () => {
    const stats = await runN(async () => ({ result: 'z', payloadBytes: 512 }), 1);
    expect(stats.payloadBytesMean).toBe(512);
    expect(stats.payloadTokensMean).toBe(128); // bytes÷4 fallback: ceil(512/4) = 128
  });
});

async function* yieldN(n: number): AsyncGenerator<number> {
  for (let i = 0; i < n; i++) yield i;
}

describe('runNStream', () => {
  it('coldTtfrMs >= 0', async () => {
    const stats = await runNStream(() => yieldN(3), 3);
    expect(stats.coldTtfrMs).toBeGreaterThanOrEqual(0);
  });

  it('warmTtfr.n = runs - 1', async () => {
    const stats = await runNStream(() => yieldN(3), 5);
    expect(stats.warmTtfr.n).toBe(4);
  });

  it('runs field equals the argument passed', async () => {
    const stats = await runNStream(() => yieldN(1), 4);
    expect(stats.runs).toBe(4);
  });

  it('handles an empty iterable — records time to completion, not time to first item', async () => {
    const stats = await runNStream(() => yieldN(0), 3);
    expect(stats.coldTtfrMs).toBeGreaterThanOrEqual(0);
    expect(stats.warmTtfr.n).toBe(2);
  });

  it('does not consume all items — only pulls until the first one', async () => {
    let count = 0;
    async function* counting(): AsyncGenerator<number> {
      while (true) {
        count++;
        yield count;
      }
    }
    await runNStream(counting, 3);
    // 3 runs, each pulls exactly 1 item
    expect(count).toBe(3);
  });
});
