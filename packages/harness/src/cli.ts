#!/usr/bin/env -S npx tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cac } from 'cac';
import { RestAdapter, loadQuerySet, renderBenchmarkMarkdown, runBenchmark } from './bench/index.js';
import { profileVault } from './profiler/index.js';
import { renderVaultStatsMarkdown } from './profiler/report.js';
import { copyVault, renderSafetyMarkdown, runSafety } from './safety/index.js';

const cli = cac('seekstone-harness');

// ---------- profile ----------
cli
  .command('profile', 'Walk the vault and emit vault-stats.{json,md}.')
  .option('--vault <path>', 'Vault root (or set SEEKSTONE_VAULT).')
  .option('--out <dir>', 'Output directory.', { default: 'reports' })
  .action(async (opts) => {
    const vault = resolve(needArg(opts.vault ?? process.env.SEEKSTONE_VAULT, 'vault'));
    const outDir = resolve(opts.out);
    await mkdir(outDir, { recursive: true });
    const stats = await profileVault({ vaultRoot: vault });
    await writeFile(join(outDir, 'vault-stats.json'), JSON.stringify(stats, null, 2));
    await writeFile(join(outDir, 'vault-stats.md'), renderVaultStatsMarkdown(stats));
    console.log(`profile: ${stats.counts.notes} notes, ${stats.counts.totalFiles} files.`);
    console.log(`         wrote ${join(outDir, 'vault-stats.json')}`);
    console.log(`         wrote ${join(outDir, 'vault-stats.md')}`);
  });

// ---------- bench ----------
cli
  .command('bench', 'Run the benchmark harness against a backend.')
  .option('--backend <name>', 'Adapter name. Today: "rest".', { default: 'rest' })
  .option('--queries <file>', 'Query set JSON.', {
    default: 'packages/harness/queries/default.json',
  })
  .option('--stats <file>', 'vault-stats.json (used to auto-pick read targets).')
  .option('--out <dir>', 'Output directory.', { default: 'reports' })
  .option('--runs <n>', 'Override runs-per-measurement.')
  .action(async (opts) => {
    const outDir = resolve(opts.out);
    await mkdir(outDir, { recursive: true });
    const qs = await loadQuerySet(resolve(opts.queries));
    if (opts.runs) qs.runs = Number(opts.runs);
    const backend = buildBackend(opts.backend);
    try {
      const summary = await runBenchmark({
        backend,
        querySet: qs,
        vaultStatsPath: opts.stats ? resolve(opts.stats) : undefined,
      });
      await writeFile(
        join(outDir, `benchmark-${backend.name}.json`),
        JSON.stringify(summary, null, 2),
      );
      await writeFile(
        join(outDir, `benchmark-${backend.name}.md`),
        renderBenchmarkMarkdown(summary),
      );
      console.log(`bench (${backend.name}): ${summary.search.length} queries × ${qs.runs} runs.`);
      console.log(`         wrote ${join(outDir, `benchmark-${backend.name}.json`)}`);
      console.log(`         wrote ${join(outDir, `benchmark-${backend.name}.md`)}`);
    } finally {
      await backend.close?.();
    }
  });

// ---------- safety ----------
cli
  .command('safety', 'Run the write-safety round-trip suite (operates on a vault COPY).')
  .option('--vault <path>', 'Original vault root (read-only).')
  .option('--backend <name>', 'Adapter that writes to the copy. Today: "rest".', {
    default: 'rest',
  })
  .option(
    '--copy-vault-root <path>',
    'Path of the copy. Required for REST adapter — must match the vault Obsidian is pointed at.',
  )
  .option('--sample <n>', 'How many frontmatter-heavy notes to test.', { default: 25 })
  .option('--out <dir>', 'Output directory.', { default: 'reports' })
  .action(async (opts) => {
    const original = resolve(needArg(opts.vault ?? process.env.SEEKSTONE_VAULT, 'vault'));
    const outDir = resolve(opts.out);
    await mkdir(outDir, { recursive: true });

    let copyRoot: string;
    if (opts.copyVaultRoot) {
      copyRoot = resolve(opts.copyVaultRoot);
      console.warn(`safety: using existing copy at ${copyRoot}`);
    } else {
      const { copyRoot: created } = await copyVault(original);
      copyRoot = created;
      console.warn(`safety: copied vault → ${copyRoot}`);
      console.warn(
        `safety: ⚠ for the REST adapter you must point Obsidian at this copy before continuing.`,
      );
      console.warn(`safety: aborting — re-run with --copy-vault-root ${copyRoot}`);
      return;
    }

    const backend = buildBackend(opts.backend);
    try {
      const summary = await runSafety({
        originalVaultRoot: original,
        backend,
        vaultCopyRoot: copyRoot,
        sampleSize: Number(opts.sample),
      });
      await writeFile(
        join(outDir, `safety-${backend.name}.json`),
        JSON.stringify(summary, null, 2),
      );
      await writeFile(join(outDir, `safety-${backend.name}.md`), renderSafetyMarkdown(summary));
      console.log(
        `safety (${backend.name}): identity ${summary.passByOp.identity.pass}/${summary.passByOp.identity.pass + summary.passByOp.identity.fail}, body-append ${summary.passByOp['body-append'].pass}/${summary.passByOp['body-append'].pass + summary.passByOp['body-append'].fail}, fm-edit ${summary.passByOp['fm-edit'].pass}/${summary.passByOp['fm-edit'].pass + summary.passByOp['fm-edit'].fail}`,
      );
    } finally {
      await backend.close?.();
    }
  });

cli.help();
cli.version('0.0.0');
cli.parse();

// ---------- helpers ----------

function needArg<T>(v: T | undefined, name: string): T {
  if (v == null || v === '') {
    console.error(`Missing required --${name}.`);
    process.exit(2);
  }
  return v;
}

function buildBackend(name: string) {
  if (name === 'rest') {
    const baseUrl = process.env.SEEKSTONE_REST_URL ?? 'https://127.0.0.1:27124';
    const apiKey = needArg(process.env.SEEKSTONE_REST_API_KEY, 'SEEKSTONE_REST_API_KEY env var');
    return new RestAdapter({ baseUrl, apiKey });
  }
  console.error(`Unknown backend: ${name}. Known: rest.`);
  process.exit(2);
}
