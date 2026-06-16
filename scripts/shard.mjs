/**
 * Split a buffer into byte-slices no larger than `max`.
 *
 * The .mcpb server bundle is a single large ESM file. Claude Desktop's local
 * install preview silently rejects a bundle if *any* file inside it exceeds
 * ~108KB (SHA-169) — no dialog, no error. So we ship the bundle as a set of
 * sub-cap shards (`index.NNN.part`) that the loader concatenates back at
 * startup. Splitting is a plain byte slice; reassembly is plain concatenation,
 * so the round-trip is exact.
 */

// Shard ceiling. Held comfortably below the observed ~108KB cap so the metadata
// files (manifest/package.json/README) and any zip overhead also stay clear.
export const MAX_SHARD_BYTES = 95 * 1024;

// Hard guard for the whole bundle: no packed file may exceed this. Margin below
// the ~108KB cap leaves room without being so tight it risks a silent reject.
export const MAX_FILE_BYTES = 100 * 1024;

/**
 * @param {Buffer} buf
 * @param {number} [max]
 * @returns {Buffer[]} byte-slices whose concatenation equals `buf`
 */
export function shard(buf, max = MAX_SHARD_BYTES) {
  if (max <= 0) throw new Error(`shard: max must be positive, got ${max}`);
  const parts = [];
  for (let i = 0; i < buf.length; i += max) parts.push(buf.subarray(i, i + max));
  return parts;
}
