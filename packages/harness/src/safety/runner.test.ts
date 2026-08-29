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

describe('runSafety — behavioral ops and skip semantics', () => {
  let origDir: string;
  let copyDir: string;

  beforeAll(async () => {
    origDir = await mkdtemp(join(tmpdir(), 'seekstone-safety-behav-orig-'));
    copyDir = await mkdtemp(join(tmpdir(), 'seekstone-safety-behav-copy-'));
    await writeNotes(origDir);
  });

  afterAll(async () => {
    await rm(origDir, { recursive: true, force: true });
    await rm(copyDir, { recursive: true, force: true });
  });

  it('runs all behavioral ops to pass with the fs reference adapter', async () => {
    await writeNotes(copyDir);
    const freshAdapter = await FsAdapter.build({ vaultRoot: copyDir });
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: freshAdapter,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp['recoverable-delete'].pass).toBe(3);
    expect(summary.passByOp['create-no-clobber'].pass).toBe(3);
    expect(summary.passByOp['cas-conflict'].pass).toBe(3);
    // The fs reference has no journal — undo is a server capability, so the
    // op is skipped (a capability-matrix cell), never failed.
    expect(summary.passByOp['undo-roundtrip'].skipped).toBe(3);
  });

  it('records skipped (not failed) for a write-only backend without the optional methods', async () => {
    await writeNotes(copyDir);
    const fsBacked = await FsAdapter.build({ vaultRoot: copyDir });
    const writeOnly = {
      name: 'write-only',
      description: 'minimal backend without safety capabilities',
      search: fsBacked.search.bind(fsBacked),
      read: fsBacked.read.bind(fsBacked),
      write: fsBacked.write.bind(fsBacked),
      list: fsBacked.list.bind(fsBacked),
    };
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: writeOnly,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    for (const op of [
      'recoverable-delete',
      'create-no-clobber',
      'cas-conflict',
      'undo-roundtrip',
    ] as const) {
      expect(summary.passByOp[op].skipped).toBe(3);
      expect(summary.passByOp[op].fail).toBe(0);
    }
    const reasons = summary.notes.flatMap((n) =>
      n.ops.filter((o) => o.status === 'skipped').map((o) => o.reason),
    );
    expect(reasons.some((r) => r?.includes('backend does not support'))).toBe(true);
  });

  it('records a fail (not a crash) when the backend write throws', async () => {
    await writeNotes(copyDir);
    const fsBacked = await FsAdapter.build({ vaultRoot: copyDir });
    const refusingWrite = {
      name: 'refusing',
      description: 'backend whose write always refuses',
      search: fsBacked.search.bind(fsBacked),
      read: fsBacked.read.bind(fsBacked),
      write: async (): Promise<never> => {
        throw new Error('Note already exists. Use append or update tools instead.');
      },
      list: fsBacked.list.bind(fsBacked),
    };
    const summary = await runSafety({
      originalVaultRoot: origDir,
      backend: refusingWrite,
      vaultCopyRoot: copyDir,
      sampleSize: 25,
    });
    expect(summary.passByOp.identity.fail).toBe(3);
    const firstFail = summary.notes[0]?.ops.find((o) => o.status === 'fail');
    expect(firstFail?.reason).toContain('write call errored');
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
