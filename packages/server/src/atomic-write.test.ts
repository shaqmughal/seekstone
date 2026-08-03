import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { atomicWrite } from './atomic-write.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seekstone-atomic-write-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  it('creates a new file with the exact content', async () => {
    const p = join(dir, 'new.md');
    await atomicWrite(p, '# New\ncontent — exact\n');
    expect(await readFile(p, 'utf8')).toBe('# New\ncontent — exact\n');
  });

  it('replaces an existing file', async () => {
    const p = join(dir, 'existing.md');
    await writeFile(p, 'old', 'utf8');
    await atomicWrite(p, 'replacement');
    expect(await readFile(p, 'utf8')).toBe('replacement');
  });

  it('leaves no temp file behind on success', async () => {
    await atomicWrite(join(dir, 'clean.md'), 'x');
    const entries = await readdir(dir);
    expect(entries.some((e) => e.includes('.seekstone-tmp'))).toBe(false);
  });
});
