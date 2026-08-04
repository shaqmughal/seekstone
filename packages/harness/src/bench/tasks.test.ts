import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTaskSet } from './tasks.js';

async function writeTaskFile(content: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'seekstone-tasks-'));
  const path = join(dir, 'tasks.json');
  await writeFile(path, JSON.stringify(content));
  return path;
}

const validTask = {
  id: 't1',
  question: 'What is X?',
  searchQuery: 'x',
  readTopK: 3,
};

describe('loadTaskSet', () => {
  it('parses a valid task set and applies the runs default of 5', async () => {
    const path = await writeTaskFile({ tasks: [validTask] });
    const ts = await loadTaskSet(path);
    expect(ts.tasks).toHaveLength(1);
    expect(ts.tasks[0]?.id).toBe('t1');
    expect(ts.runs).toBe(5);
  });

  it('honours an explicit runs value', async () => {
    const path = await writeTaskFile({ tasks: [validTask], runs: 9 });
    const ts = await loadTaskSet(path);
    expect(ts.runs).toBe(9);
  });

  it('throws when the file has no tasks', async () => {
    const path = await writeTaskFile({ tasks: [] });
    await expect(loadTaskSet(path)).rejects.toThrow(/has no tasks/);
  });

  it('throws when a task is missing id/question/searchQuery', async () => {
    const path = await writeTaskFile({ tasks: [{ id: 't1', readTopK: 3 }] });
    await expect(loadTaskSet(path)).rejects.toThrow(/id, question and searchQuery/);
  });

  it('throws when readTopK is out of range (adapters cap search hits at 10)', async () => {
    const path = await writeTaskFile({ tasks: [{ ...validTask, readTopK: 11 }] });
    await expect(loadTaskSet(path)).rejects.toThrow(/between 1 and 10/);
    const zero = await writeTaskFile({ tasks: [{ ...validTask, readTopK: 0 }] });
    await expect(loadTaskSet(zero)).rejects.toThrow(/between 1 and 10/);
  });

  it('parses the committed tasks.json', async () => {
    const committed = new URL('../../queries/tasks.json', import.meta.url).pathname;
    const ts = await loadTaskSet(committed);
    expect(ts.tasks.length).toBeGreaterThanOrEqual(3);
    for (const t of ts.tasks) {
      expect(t.question.length).toBeGreaterThan(0);
      expect(t.searchQuery.length).toBeGreaterThan(0);
    }
  });
});
