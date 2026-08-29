import { mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsAdapter } from '../bench/adapters/fs.js';
import { SeekstoneAdapter } from '../bench/adapters/seekstone.js';
import type { Backend } from '../bench/backend.js';
import {
  casConflictOp,
  createNoClobberOp,
  recoverableDeleteOp,
  undoRoundtripOp,
} from './behavioral-ops.js';

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
    // The fs reference adapter declares all three guards, so the outcome
    // records full coverage.
    expect(r.reason).toBe('guards refused: write, move, delete');
    expect(await readFile(abs, 'utf8')).toBe(raw); // restored
  });

  it('records write-only coverage for a backend without casMove/casDelete', async () => {
    const { rel, abs, raw } = await seed('cas-write-only.md');
    const writeOnly: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: backend.casWrite.bind(backend),
    };
    const r = await casConflictOp(writeOnly, rel, abs);
    expect(r.status).toBe('pass');
    expect(r.reason).toBe('guards refused: write');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails when a stale-hash move lands anyway', async () => {
    const { rel, abs, raw } = await seed('cas-bad-move.md');
    const unguardedMove: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: backend.casWrite.bind(backend),
      casMove: async (from: string, to: string) => {
        await rename(join(vaultDir, from), join(vaultDir, to)); // ignores the hash
      },
    };
    const r = await casConflictOp(unguardedMove, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('stale-hash move reported success');
    expect(await readFile(abs, 'utf8')).toBe(raw); // restored at the source
  });

  it('fails when a stale-hash delete lands anyway', async () => {
    const { rel, abs, raw } = await seed('cas-bad-delete.md');
    const unguardedDelete: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: backend.casWrite.bind(backend),
      casDelete: async (p: string) => {
        await unlink(join(vaultDir, p)); // ignores the hash
      },
    };
    const r = await casConflictOp(unguardedDelete, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('stale-hash delete reported success');
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

describe('undoRoundtripOp', () => {
  it('passes against the shipped server: write and delete both undo byte-identically', async () => {
    const { rel, abs, raw } = await seed('undo.md');
    const server = await SeekstoneAdapter.build({ vaultRoot: vaultDir });
    const r = await undoRoundtripOp(server, rel, abs);
    expect(r.status).toBe('pass');
    expect(r.reason).toBe('undone: write, delete');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails when undo does not restore the original bytes, and restores them itself', async () => {
    const { rel, abs, raw } = await seed('undo-broken.md');
    const broken: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: backend.casWrite.bind(backend),
      undoLastWrite: async () => {
        await writeFile(join(vaultDir, rel), 'not the original\n', 'utf8');
      },
    };
    const r = await undoRoundtripOp(broken, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('did not restore');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails when the undo call itself errors', async () => {
    const { rel, abs, raw } = await seed('undo-err.md');
    const erroring: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: backend.casWrite.bind(backend),
      undoLastWrite: async () => {
        throw new Error('no journal');
      },
    };
    const r = await undoRoundtripOp(erroring, rel, abs);
    expect(r.status).toBe('fail');
    expect(r.reason).toContain('undo after write errored');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });
});

describe('undoRoundtripOp edge cases', () => {
  it('covers write only when the backend has no deleteNote', async () => {
    const { rel, abs, raw } = await seed('undo-nodelete.md');
    const server = await SeekstoneAdapter.build({ vaultRoot: vaultDir });
    const noDelete: Backend = {
      ...backendShim(),
      readWithHash: server.readWithHash.bind(server),
      casWrite: server.casWrite.bind(server),
      undoLastWrite: server.undoLastWrite.bind(server),
    };
    const r = await undoRoundtripOp(noDelete, rel, abs);
    expect(r.status).toBe('pass');
    expect(r.reason).toBe('undone: write');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });

  it('fails when the write call errors or leaves the note unchanged', async () => {
    const { rel, abs, raw } = await seed('undo-noop.md');
    const noop: Backend = {
      ...backendShim(),
      readWithHash: backend.readWithHash.bind(backend),
      casWrite: async () => {},
      undoLastWrite: async () => {},
    };
    const r1 = await undoRoundtripOp(noop, rel, abs);
    expect(r1.status).toBe('fail');
    expect(r1.reason).toContain('did not change the note');
    const erroring: Backend = {
      ...noop,
      casWrite: async () => {
        throw new Error('refused');
      },
    };
    const r2 = await undoRoundtripOp(erroring, rel, abs);
    expect(r2.status).toBe('fail');
    expect(r2.reason).toContain('write call errored');
    expect(await readFile(abs, 'utf8')).toBe(raw);
  });
});
