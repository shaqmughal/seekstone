import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Embedder } from '@seekstone/core/embed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildLexicalContext, type LexicalContext } from './lexical.js';
import { buildShipped, type ShippedHandle } from './shipped.js';

function stubEmbedder(id: string): Embedder {
  return {
    id,
    dim: 3,
    embed: (text) => {
      const out = new Float32Array(3);
      out[/\b(wind|air|mill)\b/i.test(text) ? 0 : 2] = 1;
      return out;
    },
  };
}

describe('buildShipped with multiple handles on one ctx (SHA-323)', () => {
  let vault: string;
  let lexical: LexicalContext;
  let a: ShippedHandle;
  let b: ShippedHandle;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-shipped-'));
    await mkdir(join(vault, 'Notes'), { recursive: true });
    await writeFile(
      join(vault, 'Notes', 'Windmill.md'),
      '# Windmill\n\nA mill worked by the wind.\n',
    );
    lexical = await buildLexicalContext(vault);
    const load = async (dir: string) => stubEmbedder(basename(dir));
    const cacheDir = join(vault, '.cache');
    a = await buildShipped(lexical.ctx, '/models/stub-a', cacheDir, load);
    b = await buildShipped(lexical.ctx, '/models/stub-b', cacheDir, load);
  });
  afterAll(async () => {
    a.stop();
    b.stop();
    await rm(vault, { recursive: true, force: true });
  });

  it('each rank call searches through its own semantic index', () => {
    expect(a.rank('semantic')('moving air')).toEqual(['Notes/Windmill.md']);
    expect(lexical.ctx.semantic?.embedder.id).toBe('stub-a');
    expect(b.rank('semantic')('moving air')).toEqual(['Notes/Windmill.md']);
    expect(lexical.ctx.semantic?.embedder.id).toBe('stub-b');
    // Interleaving back to the first handle must re-point the ctx, not
    // keep serving the most recently built model.
    a.rank('hybrid')('moving air');
    expect(lexical.ctx.semantic?.embedder.id).toBe('stub-a');
  });
});
