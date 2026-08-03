import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsAdapter } from '../bench/adapters/fs.js';
import type { Backend } from '../bench/backend.js';
import { casConflictOp, createNoClobberOp, recoverableDeleteOp } from './behavioral-ops.js';

let vaultDir: string;
let backend: FsAdapter;

// Unique content per note — mirrors real vaults and prevents a stale trash
// copy from one test satisfying another's byte-identity search.
const noteFor = (name: string): string => `---\ntitle: ${name}\n---\n\nbody of ${name}\n`;

beforeAll(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-behavioral-ops-'));
  await writeFile(join(vaultDir, 'seed.md'), noteFor('seed.md'), 'utf8');
  backend = await FsAdapter.build({ vaultRoot: vaultDir });
});

afterAll(async () => {
  await rm(vaultDir, { recursive: true, force: true });
});

async function seed(name: string): Promise<{ rel: string; abs: string; raw: string }> {
  const abs = join(vaultDir, name);
  const raw = noteFor(name);
  await writeFile(abs, raw, 'utf8');
  return { rel: name, abs, raw };
}

describe('recoverableDeleteOp', () => {
  it('passes for a trash-style delete and restores the note', async () => {
    const { rel, abs, raw } = await seed('rd.md');
    const r = await recoverableDeleteOp(backend, rel, abs, vaultDir);
    expect(r.status).toBe('pass');
    expect(r.reason).toContain('.trash/');
    // restored for subsequent ops
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails for a permanent delete', async () => {
    const { rel, abs, raw } = await seed('perm.md');
    const permanentBackend: Backend = {
      ...backendShim(),
      deleteNote: async (p: string) => {
        await unlink(join(vaultDir, p));
      },
    };
    const r = await recoverableDeleteOp(permanentBackend, rel, abs, vaultDir);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('no byte-identical recoverable copy');
    expect(await readFile(abs, 'utf8')).toBe(raw); // restored either way
  });
});

describe('createNoClobberOp', () => {
  it('passes when the create call refuses an existing path', async () => {
    const { rel, abs, raw } = await seed('nc.md');
    const r = await createNoClobberOp(backend, rel, abs);
    expect(r.status).toBe('pass');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails when the create silently clobbers, and restores the bytes', async () => {
    const { rel, abs, raw } = await seed('clobber.md');
    const clobberBackend: Backend = {
      ...backendShim(),
      createNote: async (p: string, content: string) => {
        await writeFile(join(vaultDir, p), content, 'utf8'); // no wx flag — clobbers
      },
    };
    const r = await createNoClobberOp(clobberBackend, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('clobbered');
    expect(await readFile(abs, 'utf8')).toBe(raw); // restored
  });
});

describe('casConflictOp', () => {
  it('passes when the stale write is refused and the concurrent edit survives during the check', async () => {
    const { rel, abs, raw } = await seed('cas.md');
    const r = await casConflictOp(backend, rel, abs);
    expect(r.status).toBe('pass');
    expect(await readFile(abs, 'utf8')).toBe(raw); // restored
  });

  it('fails when the stale write lands anyway', async () => {
    const { rel, abs, raw } = await seed('unguarded.md');
    const unguardedBackend: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: async (p: string, content: string) => {
        await writeFile(join(vaultDir, p), content, 'utf8'); // ignores the hash
      },
    };
    const r = await casConflictOp(unguardedBackend, rel, abs);
    expect(r.status).toBe('fail');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });
});

describe('caller-contract guards', () => {
  it('each op throws when its capability was not checked by the caller', async () => {
    const bare = backendShim();
    const { rel, abs } = await seed('guard.md');
    await expect(recoverableDeleteOp(bare, rel, abs, vaultDir)).rejects.toThrow(
      'caller must check',
    );
    await expect(createNoClobberOp(bare, rel, abs)).rejects.toThrow('caller must check');
    await expect(casConflictOp(bare, rel, abs)).rejects.toThrow('caller must check');
  });

  it('recoverable-delete records a fail when the delete call itself errors', async () => {
    const { rel, abs, raw } = await seed('del-err.md');
    const erroring: Backend = {
      ...backendShim(),
      deleteNote: async () => {
        throw new Error('permission denied by server');
      },
    };
    const r = await recoverableDeleteOp(erroring, rel, abs, vaultDir);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('delete call errored');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('create-no-clobber fails when the server errors but still modified the note', async () => {
    const { rel, abs, raw } = await seed('err-modify.md');
    const sneaky: Backend = {
      ...backendShim(),
      createNote: async (p: string, content: string) => {
        await writeFile(join(vaultDir, p), content, 'utf8');
        throw new Error('failed after writing');
      },
    };
    const r = await createNoClobberOp(sneaky, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('errored but still modified');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('cas-conflict fails when the write errors but the concurrent edit was lost', async () => {
    const { rel, abs, raw } = await seed('cas-lost.md');
    const destructive: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: async (p: string) => {
        await writeFile(join(vaultDir, p), 'stomped the concurrent edit', 'utf8');
        throw new Error('conflict reported anyway');
      },
    };
    const r = await casConflictOp(destructive, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('concurrent edit was lost');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });
});

/** Minimal Backend stub — behavioral ops only touch the optional safety methods. */
function backendShim(): Backend {
  const unused = async (): Promise<never> => {
    throw new Error('not used by this op');
  };
  return {
    name: 'shim',
    description: 'test shim',
    search: unused,
    read: unused,
    write: unused,
    list: unused,
  };
}
