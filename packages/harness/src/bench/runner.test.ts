import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsAdapter } from './adapters/fs.js';
import { runBenchmark } from './runner.js';

const SMALL_CONTENT = `---
title: Small Note
---
This note has some content for benchmarking.
`;

const LARGE_CONTENT = `---
title: Large Note
tags: [benchmark, test]
date: 2026-01-01
---
This note has much more content to simulate a larger file for benchmarking purposes.
It includes multiple paragraphs and lines.

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
`;

describe('runBenchmark', () => {
  let vaultDir: string;
  let adapter: FsAdapter;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-runner-test-'));
    await writeFile(join(vaultDir, 'small.md'), SMALL_CONTENT, 'utf8');
    await writeFile(join(vaultDir, 'large.md'), LARGE_CONTENT, 'utf8');
    adapter = await FsAdapter.build({ vaultRoot: vaultDir });
  });

  afterAll(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('returns a summary object without throwing', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary).toBeDefined();
  });

  it('summary.search has length = 1 (one query)', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.search).toHaveLength(1);
  });

  it('summary.search[0].stats.coldMs >= 0', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.search[0]?.stats.coldMs).toBeGreaterThanOrEqual(0);
  });

  it('summary.search[0].stats.runs = 2', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.search[0]?.stats.runs).toBe(2);
  });

  it('summary.backend.name = "fs"', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.backend.name).toBe('fs');
  });

  it('summary.read.small is not null when reads.small is set', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.read.small).not.toBeNull();
  });

  it('summary.read.large is not null when reads.large is set', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.read.large).not.toBeNull();
  });

  it('summary.read.small.path equals the resolved path', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: 'small.md', large: 'large.md' },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.read.small?.path).toBe('small.md');
  });

  it('summary.read is {small: null, large: null} when reads are null and no statsPath', async () => {
    const qs = {
      queries: [{ id: 'q1', kind: 'single' as const, query: 'content' }],
      reads: { small: null, large: null },
      runs: 2,
    };
    const summary = await runBenchmark({ backend: adapter, querySet: qs });
    expect(summary.read.small).toBeNull();
    expect(summary.read.large).toBeNull();
  });
});
