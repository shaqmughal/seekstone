import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsAdapter } from '../bench/adapters/fs.js';
import { prepareSafetyVault, runSafety } from './runner.js';

const NOTE1 = `---
title: T1
tags: [a]
date: 2026-01-01
status: done
---
# Note One

Body one with some words.
`;

const NOTE2 = `---
title: T2
tags: [b]
date: 2026-01-02
status: draft
---
# Note Two

Body two with some words.
`;

const NOTE3 = `---
title: T3
tags: [c]
date: 2026-01-03
status: active
---
# Note Three

Body three with some words.
`;

async function writeNotes(dir: string): Promise<void> {
  await writeFile(join(dir, 'note1.md'), NOTE1, 'utf8');
  await writeFile(join(dir, 'note2.md'), NOTE2, 'utf8');
  await writeFile(join(dir, 'note3.md'), NOTE3, 'utf8');
}

describe('runSafety', () => {
  let origDir: string;
  let copyDir: string;
  let adapter: FsAdapter;

  beforeAll(async () => {
    origDir = await mkdtemp(join(tmpdir(), 'seekstone-safety-runner-orig-'));
    copyDir = await mkdtemp(join(tmpdir(), 'seekstone-safety-runner-copy-'));
    await writeNotes(origDir);
    await writeNotes(copyDir);
    adapter = await FsAdapter.build({ vaultRoot: copyDir });
  });

  afterAll(async () => {
    await rm(origDir, { recursive: true, force: true });
    await rm(copyDir, { recursive: true, force: true });
  });

  it('passByOp.identity.pass = 3 (all notes pass identity)', async () => {
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: adapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp.identity.pass).toBe(3);
  });

  it('passByOp["body-append"].pass = 3', async () => {
    // Re-build adapter after potential mutations from previous test
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    await writeNotes(copyDir);
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp['body-append'].pass).toBe(3);
  });

  it('passByOp["fm-edit"].pass = 3 (yaml round-trip preserves structure)', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp['fm-edit'].pass).toBe(3);
  });

  it('summary.sampleSize = 3', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.sampleSize).toBe(3);
  });

  it('summary.notes has length 3', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.notes).toHaveLength(3);
  });

  it('throws "Refusing to run" when originalVaultRoot === vaultCopyRoot', async () => {
    const freshAdapter = await FsAdapter.build({ vaultRoot: origDir });
    await expect(
      runSafety({
        originalVaultRoot: origDir,
        backend: freshAdapter,
        vaultCopyRoot: origDir,
      }),
    ).rejects.toThrow('Refusing to run');
  });

  it('passByOp["patch-note"].pass = 3 (notes all have headings)', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp['patch-note'].pass).toBe(3);
  });

  it('passByOp["replace-in-note"].pass = 3 (notes all have 4+ letter words)', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp['replace-in-note'].pass).toBe(3);
  });
});

describe('prepareSafetyVault', () => {
  it('returns a copyRoot under os.tmpdir() containing the source files', async () => {
    const { realpath } = await import('node:fs/promises');
    const srcDir = await mkdtemp(join(tmpdir(), 'seekstone-prepare-safety-src-'));
    await writeFile(join(srcDir, 'note.md'), '---\ntitle: T\n---\nBody.\n', 'utf8');
    let copyRoot: string | undefined;
    try {
      copyRoot = await prepareSafetyVault(srcDir);
      const tmpdirReal = await realpath(tmpdir());
      expect(copyRoot.startsWith(tmpdirReal)).toBe(true);
      expect(copyRoot).not.toBe(await realpath(srcDir));
    } finally {
      await rm(srcDir, { recursive: true, force: true });
      if (copyRoot) await rm(copyRoot, { recursive: true, force: true });
    }
  });
});
