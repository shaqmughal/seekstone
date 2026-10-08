#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDailyTaskBlock, taskRngFor } from './generate.js';

/**
 * Fixture v2.1 migration (SHA-285): inject the generator's checkbox-task
 * blocks into an EXISTING vault's daily notes, byte-identically to what
 * `gen-vault` would have produced had the vault been regenerated.
 *
 * Why this exists: regenerating the committed vaults requires the pinned
 * EB1911 corpus, and Project Gutenberg re-issued 28 of the 125 pinned volume
 * files after fixture v2 was generated — no byte-identical source for them
 * remains fetchable (canonical, mirrors, or Wayback), so `gen-vault` can no
 * longer reproduce the committed article notes. Task planting, however, is
 * drawn from an isolated PRNG stream and touches only `Daily Notes/` — so
 * this script replays exactly that stream (through the same
 * `buildDailyTaskBlock` the generator uses) against the committed files.
 *
 * Correctness proof (run during SHA-285): generate a vault from the
 * current-but-drifted corpus with the OLD generator, run this script on it,
 * and byte-compare against the NEW generator's output from the same corpus —
 * identical across all 1,000 daily notes.
 *
 * Usage: npx tsx packages/harness/src/fixtures/plant-tasks.ts <vaultDir> <count> [seed]
 */

const EPOCH = Date.UTC(2023, 0, 1);
const DAY = 86_400_000;

export function plantTasks(
  vaultDir: string,
  count: number,
  seed = 42,
): { tasksPlanted: number; openTasks: number; notesTouched: number } {
  const dailyNotes = Math.round(count * 0.1);
  const taskRng = taskRngFor(seed);
  let tasksPlanted = 0;
  let openTasks = 0;
  let notesTouched = 0;

  for (let d = 0; d < dailyNotes; d++) {
    const date = new Date(EPOCH + d * DAY).toISOString().slice(0, 10);
    const block = buildDailyTaskBlock(taskRng, d); // always called: the stream must advance
    if (block.lines.length === 0) continue;

    const path = join(vaultDir, 'Daily Notes', `${date}.md`);
    const content = readFileSync(path, 'utf8');
    if (content.includes('\n## Tasks\n')) {
      throw new Error(`${path} already has a Tasks section — refusing to double-plant`);
    }
    const lines = content.split('\n');

    // The generator appends the task block right after the Captured block's
    // trailing blank, before the optional inline-tag line. In the committed
    // files that tag line, when present, is the last non-empty line and is a
    // single `#tag` token.
    let insertAt = lines.length;
    const lastIdx = lines.length - (lines.at(-1) === '' ? 2 : 1);
    const last = lines[lastIdx];
    if (last !== undefined && /^#[^\s#]/.test(last)) insertAt = lastIdx;

    lines.splice(insertAt, 0, ...block.lines);
    writeFileSync(path, lines.join('\n'));
    tasksPlanted += block.planted;
    openTasks += block.open;
    notesTouched++;
  }
  return { tasksPlanted, openTasks, notesTouched };
}

// CLI entry.
const [vaultDir, countArg, seedArg] = process.argv.slice(2);
if (!vaultDir || !countArg) {
  console.error('usage: plant-tasks.ts <vaultDir> <count> [seed]');
  process.exit(2);
}
const r = plantTasks(vaultDir, Number(countArg), seedArg ? Number(seedArg) : 42);
console.log(
  `plant-tasks: ${r.tasksPlanted} tasks (${r.openTasks} open) across ${r.notesTouched} daily notes in ${vaultDir}`,
);
