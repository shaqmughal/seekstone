/**
 * Minimal safetensors reader — just enough for Model2Vec model files, which
 * hold a single F32 embedding matrix. Format: 8-byte little-endian header
 * length, JSON header mapping tensor name → { dtype, shape, data_offsets },
 * then the raw tensor data (offsets relative to the end of the header).
 *
 * F32 only by design; quantized (I8) Model2Vec variants are a documented
 * future case and fail loudly here rather than decode garbage.
 */

export interface SafeTensor {
  dtype: string;
  shape: number[];
  data: Float32Array;
}

interface TensorMeta {
  dtype: string;
  shape: number[];
  data_offsets: [number, number];
}

export function readSafetensors(buf: Uint8Array): Map<string, SafeTensor> {
  if (buf.byteLength < 8) {
    throw new Error(`safetensors: buffer too small (${buf.byteLength} bytes) to hold a header`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const headerLen = Number(view.getBigUint64(0, true));
  if (8 + headerLen > buf.byteLength) {
    throw new Error(
      `safetensors: header length ${headerLen} exceeds buffer (${buf.byteLength} bytes)`,
    );
  }
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + headerLen))) as Record<
    string,
    TensorMeta
  >;
  const dataStart = 8 + headerLen;

  const out = new Map<string, SafeTensor>();
  const unsupported: string[] = [];
  for (const [name, meta] of Object.entries(header)) {
    if (name === '__metadata__') continue;
    if (meta.dtype !== 'F32') {
      unsupported.push(`${name} (${meta.dtype})`);
      continue;
    }
    const [begin, end] = meta.data_offsets;
    const byteLen = end - begin;
    const elems = meta.shape.reduce((a, b) => a * b, 1);
    if (byteLen !== elems * 4) {
      throw new Error(
        `safetensors: tensor "${name}" data span ${byteLen} B does not match shape [${meta.shape.join(', ')}]`,
      );
    }
    if (dataStart + end > buf.byteLength) {
      throw new Error(`safetensors: tensor "${name}" extends past the end of the buffer`);
    }
    // Float32Array views require 4-byte alignment, and 8 + headerLen (or the
    // source Uint8Array's own byteOffset) may not provide it. Copy explicitly
    // when misaligned — Buffer.slice() is a view, not a copy, so it can't help.
    const absStart = buf.byteOffset + dataStart + begin;
    let data: Float32Array;
    if (absStart % 4 === 0) {
      data = new Float32Array(buf.buffer, absStart, elems);
    } else {
      const copy = new Uint8Array(byteLen);
      copy.set(buf.subarray(dataStart + begin, dataStart + end));
      data = new Float32Array(copy.buffer);
    }
    out.set(name, { dtype: meta.dtype, shape: meta.shape, data });
  }
  if (unsupported.length > 0) {
    throw new Error(`safetensors: only F32 tensors are supported; found ${unsupported.join(', ')}`);
  }
  return out;
}
