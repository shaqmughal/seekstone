import { describe, expect, it } from 'vitest';
import { readSafetensors } from './safetensors.js';
import { makeTestSafetensors } from './testutil.js';

describe('readSafetensors', () => {
  it('round-trips a single F32 matrix with shape intact', () => {
    const buf = makeTestSafetensors({
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    const tensors = readSafetensors(buf);
    const t = tensors.get('embeddings');
    expect(t).toBeDefined();
    expect(t?.shape).toEqual([2, 3]);
    expect([...(t?.data ?? [])]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reads tensor data through a misaligned data section', () => {
    // Header padding shifts the data start off 4-byte alignment for at least
    // two of these three cases; the reader must copy, not view.
    for (const pad of [1, 2, 3]) {
      const buf = makeTestSafetensors({ embeddings: [[7, 8]] }, { padHeader: pad });
      const t = readSafetensors(buf).get('embeddings');
      expect([...(t?.data ?? [])]).toEqual([7, 8]);
    }
  });

  it('reads tensors from a view with a non-zero byteOffset', () => {
    const inner = makeTestSafetensors({ embeddings: [[1.5, -2.5]] });
    const shifted = new Uint8Array(inner.length + 2);
    shifted.set(inner, 2);
    const view = shifted.subarray(2);
    const t = readSafetensors(view).get('embeddings');
    expect([...(t?.data ?? [])]).toEqual([1.5, -2.5]);
  });

  it('handles multiple tensors with sequential offsets', () => {
    const buf = makeTestSafetensors({
      a: [[1, 2]],
      b: [
        [3, 4],
        [5, 6],
      ],
    });
    const tensors = readSafetensors(buf);
    expect([...(tensors.get('a')?.data ?? [])]).toEqual([1, 2]);
    expect(tensors.get('b')?.shape).toEqual([2, 2]);
  });

  it('rejects non-F32 dtypes by name', () => {
    const buf = makeTestSafetensors({ embeddings: [[1]] }, { dtype: 'I8' });
    expect(() => readSafetensors(buf)).toThrow(/embeddings \(I8\)/);
  });

  it('rejects a truncated buffer', () => {
    const buf = makeTestSafetensors({ embeddings: [[1, 2, 3, 4]] });
    expect(() => readSafetensors(buf.subarray(0, buf.length - 4))).toThrow(/past the end/);
  });

  it('rejects a buffer smaller than the header length field', () => {
    expect(() => readSafetensors(new Uint8Array(4))).toThrow(/too small/);
  });

  it('rejects a header length pointing past the buffer', () => {
    const buf = new Uint8Array(16);
    new DataView(buf.buffer).setBigUint64(0, 9999n, true);
    expect(() => readSafetensors(buf)).toThrow(/exceeds buffer/);
  });
});
