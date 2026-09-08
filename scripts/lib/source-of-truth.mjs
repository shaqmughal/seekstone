// Code-level sources of truth shared by the docs guards and the benchmarks.json
// builder. Every number here is *derived* from the artifact that defines it —
// never typed by hand — so a doc can only be checked against the code, not
// against another doc.
//
//   tool counts      ← packages/server/src/dispatch.ts (HANDLED_TOOLS / WRITE_TOOLS)
//   guarantee count  ← docs/WRITE-SAFETY.md ("### N." headings of the contract)
//   server version   ← packages/server/package.json (the published `seekstone` package)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `{ total, read, write }` tool counts parsed from dispatch.ts. */
export function readToolCounts(root) {
  const dispatch = readFileSync(join(root, 'packages/server/src/dispatch.ts'), 'utf8');
  const handled = dispatch.match(/HANDLED_TOOLS = \[([\s\S]*?)\]/);
  if (!handled) throw new Error('cannot locate HANDLED_TOOLS in dispatch.ts');
  const total = [...handled[1].matchAll(/'[^']+'/g)].length;
  const writeTools = dispatch.match(/WRITE_TOOLS[^=]*= new Set\(\[([\s\S]*?)\]\)/);
  if (!writeTools) throw new Error('cannot locate WRITE_TOOLS in dispatch.ts');
  const write = [...writeTools[1].matchAll(/'[^']+'/g)].length;
  return { total, read: total - write, write };
}

/** Number of named guarantees in the Write-Safety Contract (contiguous "### N." headings). */
export function readGuaranteeCount(root) {
  const text = readFileSync(join(root, 'docs/WRITE-SAFETY.md'), 'utf8');
  const nums = [...text.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
  if (nums.length === 0)
    throw new Error('no "### N." guarantee headings found in docs/WRITE-SAFETY.md');
  nums.forEach((n, i) => {
    if (n !== i + 1) {
      throw new Error(
        `docs/WRITE-SAFETY.md guarantee headings are not contiguous (found ${n} at position ${i + 1})`,
      );
    }
  });
  return nums.length;
}

/** Version of the published `seekstone` package. */
export function readServerVersion(root) {
  return JSON.parse(readFileSync(join(root, 'packages/server/package.json'), 'utf8')).version;
}
