import { describe, expect, it } from 'vitest';
import { quantizeRows } from './quantize.js';
import { lcg } from './testutil.js';

function randomTable(rows: number, dim: number, seed: number): Float32Array {
  const rand = lcg(seed);
  const t = new Float32Array(rows * dim);
  for (let r = 0; r < rows; r++) {
    const mag = 10 ** (rand() * 4 - 2); // rows span 0.01..100
    for (let j = 0; j < dim; j++) t[r * dim + j] = (rand() * 2 - 1) * mag;
  }
  return t;
}

describe('quantizeRows', () => {
  it('round-trips a random table within scale/2 per element', () => {
    const rows = 64;
    const dim = 48;
    const table = randomTable(rows, dim, 1);
    const { q, scale } = quantizeRows(table, rows, dim);
    expect(q).toBeInstanceOf(Int8Array);
    expect(scale).toHaveLength(rows);
    for (let r = 0; r < rows; r++) {
      const s = scale[r] as number;
      expect(s).toBeGreaterThan(0);
      for (let j = 0; j < dim; j++) {
        const i = r * dim + j;
        const err = Math.abs((table[i] as number) - s * (q[i] as number));
        expect(err).toBeLessThanOrEqual(s / 2 + 1e-12 * Math.abs(table[i] as number));
        expect(Math.abs(q[i] as number)).toBeLessThanOrEqual(127);
      }
    }
  });

  it('maps the largest magnitude in each row to ±127, negative-only rows included', () => {
    const table = new Float32Array([0.5, -2, 1, 4, 3, -1, -1, -0.5, -0.25]);
    const { q, scale } = quantizeRows(table, 3, 3);
    expect([...q]).toEqual([32, -127, 64, 127, 95, -32, -127, -64, -32]);
    expect([...scale]).toEqual([2 / 127, 4 / 127, 1 / 127].map((s) => expect.closeTo(s, 7)));
  });

  it('handles a single-element dim', () => {
    const { q, scale } = quantizeRows(new Float32Array([3, -7, 0]), 3, 1);
    expect([...q]).toEqual([127, -127, 0]);
    expect([...scale].map((s) => s * 127)).toEqual([expect.closeTo(3, 5), expect.closeTo(7, 5), 0]);
  });

  it('quantizes an all-zero row, and one whose scale underflows, to zeros with scale 0', () => {
    const { q, scale } = quantizeRows(new Float32Array([0, 0, 1e-45, 0, 1, 2]), 3, 2);
    expect([...q]).toEqual([0, 0, 0, 0, 64, 127]);
    expect([...scale.subarray(0, 2)]).toEqual([0, 0]);
  });

  it('is deterministic: two runs give equal bytes', () => {
    const table = randomTable(32, 16, 7);
    const a = quantizeRows(table, 32, 16);
    const b = quantizeRows(table, 32, 16);
    expect(Buffer.from(a.q.buffer)).toEqual(Buffer.from(b.q.buffer));
    expect(Buffer.from(a.scale.buffer)).toEqual(Buffer.from(b.scale.buffer));
  });

  it('rejects a table whose length does not match rows × dim', () => {
    expect(() => quantizeRows(new Float32Array(5), 2, 3)).toThrow(/5 values, expected 2×3/);
  });
});
