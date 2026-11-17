/**
 * Symmetric per-row int8 quantization of a `[rows, dim]` float32 table
 * (SHA-548). Each row keeps one float32 scale, so `x ≈ scale[r] * q[r, j]`
 * with error at most `scale[r] / 2` per element. All-zero rows get scale 0.
 * Pure function of the input: the same table always gives the same bytes.
 */
export interface QuantizedRows {
  q: Int8Array;
  scale: Float32Array;
}

export function quantizeRows(table: Float32Array, rows: number, dim: number): QuantizedRows {
  if (table.length !== rows * dim) {
    throw new Error(`quantizeRows: table has ${table.length} values, expected ${rows}×${dim}`);
  }
  const q = new Int8Array(rows * dim);
  const scale = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const base = r * dim;
    let maxAbs = 0;
    for (let j = 0; j < dim; j++) {
      const a = Math.abs(table[base + j] as number);
      if (a > maxAbs) maxAbs = a;
    }
    if (maxAbs === 0) continue;
    // Store the scale as float32 first and divide by that stored value, so the
    // error bound holds against the scale the gather paths actually read.
    scale[r] = maxAbs / 127;
    const s = scale[r] as number;
    if (s === 0) continue; // subnormal row: the scale underflows, keep it zero
    for (let j = 0; j < dim; j++) {
      const v = Math.round((table[base + j] as number) / s);
      q[base + j] = v > 127 ? 127 : v < -127 ? -127 : v;
    }
  }
  return { q, scale };
}
