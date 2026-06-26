#!/usr/bin/env -S npx tsx
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cac } from 'cac';
import { McpObsidianAdapter } from './bench/adapters/mcp-obsidian.js';
import { McpvaultAdapter } from './bench/adapters/mcpvault.js';
import { ObsidianMcpAdapter } from './bench/adapters/obsidian-mcp.js';
import { ObsidianMcpProAdapter } from './bench/adapters/obsidian-mcp-pro.js';
import { ObsidianMcpServerAdapter } from './bench/adapters/obsidian-mcp-server.js';
import { SeekstoneAdapter } from './bench/adapters/seekstone.js';
import { renderComparisonMarkdown } from './bench/compare.js';
import {
  FsAdapter,
  loadQuerySet,
  RestAdapter,
  renderBenchmarkMarkdown,
  runBenchmark,
} from './bench/index.js';
import { renderScalingMarkdown, type ScaleGroup } from './bench/scaling.js';
import { fetchCorpus, loadCorpus } from './fixtures/corpus.js';
import { generateVault } from './fixtures/generate.js';
import { profileVault } from './profiler/index.js';
import { renderVaultStatsMarkdown } from './profiler/report.js';
import { copyVault, renderSafetyMarkdown, runSafety } from './safety/index.js';

// Anchor fixture defaults to this package, independent of the caller's cwd
// (the `start` script runs tsx from packages/harness).
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));
const DEFAULT_QUERIES = fileURLToPath(new URL('../queries/default.json', import.meta.url));

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
  .option('--backend <name>', 'Adapter name: "rest" or "fs".', { default: 'rest' })
  .option('--vault <path>', 'Vault root. Required for fs backend (or set SEEKSTONE_VAULT).')
  .option('--queries <file>', 'Query set JSON.', { default: DEFAULT_QUERIES })
  .option('--stats <file>', 'vault-stats.json (used to auto-pick read targets).')
  .option('--out <dir>', 'Output directory.', { default: 'reports' })
  .option('--runs <n>', 'Override runs-per-measurement.')
  .action(async (opts) => {
    const outDir = resolve(opts.out);
    await mkdir(outDir, { recursive: true });
    const qs = await loadQuerySet(resolve(opts.queries));
    if (opts.runs) qs.runs = Number(opts.runs);
    const vaultRoot = opts.vault ?? process.env.SEEKSTONE_VAULT;
    const backend = await buildBackend(opts.backend, vaultRoot);
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
  .option('--backend <name>', 'Adapter that writes to the copy: "rest" or "fs".', {
    default: 'rest',
  })
  .option(
    '--copy-vault-root <path>',
    'Path of the copy. For REST: must match the vault Obsidian is pointed at. For fs: auto-used.',
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
      if (opts.backend === 'rest') {
        console.warn(
          `safety: ⚠ for the REST adapter you must point Obsidian at this copy before continuing.`,
        );
        console.warn(`safety: aborting — re-run with --copy-vault-root ${copyRoot}`);
        return;
      }
    }

    // Build the backend pointed at the copy — for fs this is the vault it will write to.
    const backend = await buildBackend(opts.backend, copyRoot);
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
      const safetyOps = Object.entries(summary.passByOp)
        .map(([op, r]) => `${op} ${r.pass}/${r.pass + r.fail}`)
        .join(', ');
      console.log(`safety (${backend.name}): ${safetyOps}`);
    } finally {
      await backend.close?.();
    }
  });

// ---------- compare ----------
cli
  .command('compare', 'Generate a cross-adapter comparison report from benchmark JSON files.')
  .option('--reports <files>', 'Comma-separated paths to benchmark-*.json files.')
  .option('--out <dir>', 'Output directory.', { default: 'reports' })
  .action(async (opts) => {
    const paths = needArg(opts.reports as string, 'reports')
      .split(',')
      .map((p: string) => resolve(p.trim()));
    const summaries = await Promise.all(
      paths.map(async (p: string) => {
        const raw = await readFile(p, 'utf8');
        return JSON.parse(raw) as import('./bench/runner.js').BenchmarkSummary;
      }),
    );
    const outDir = resolve(opts.out);
    await mkdir(outDir, { recursive: true });
    const md = renderComparisonMarkdown(summaries);
    const outPath = join(outDir, 'comparison.md');
    await writeFile(outPath, md);
    console.log(`compare: wrote ${outPath}`);
  });

// ---------- fetch-corpus ----------
cli
  .command(
    'fetch-corpus',
    'Download the public-domain EB1911 corpus volumes (verified by checksum).',
  )
  .option('--manifest <file>', 'Corpus manifest JSON.', {
    default: `${FIXTURES}/corpus/manifest.json`,
  })
  .option('--raw <dir>', 'Destination for raw volume text.', {
    default: `${FIXTURES}/corpus/raw`,
  })
  .action(async (opts) => {
    const { fetched, skipped } = await fetchCorpus(resolve(opts.manifest), resolve(opts.raw), (m) =>
      console.log(`fetch-corpus: ${m}`),
    );
    console.log(`fetch-corpus: ${fetched} fetched, ${skipped} already present (verified).`);
  });

// ---------- gen-vault ----------
cli
  .command('gen-vault', 'Generate the deterministic synthetic benchmark vault from the corpus.')
  .option('--count <n>', 'Number of notes to emit.', { default: 10000 })
  .option('--seed <n>', 'PRNG seed (same corpus+count+seed → identical vault).', { default: 42 })
  .option('--raw <dir>', 'Corpus raw volume directory.', { default: `${FIXTURES}/corpus/raw` })
  .option('--out <dir>', 'Vault output directory (wiped and recreated).', {
    default: `${FIXTURES}/vault`,
  })
  .action(async (opts) => {
    const rawDir = resolve(opts.raw);
    const outDir = resolve(opts.out);
    const corpus = loadCorpus(rawDir);
    if (corpus.length === 0) {
      console.error(`gen-vault: no corpus found in ${rawDir}. Run \`fetch-corpus\` first.`);
      process.exit(2);
    }
    const r = generateVault({
      corpus,
      count: Number(opts.count),
      seed: Number(opts.seed),
      outDir,
    });
    console.log(
      `gen-vault: ${r.notes} notes (${r.articleNotes} article, ${r.dailyNotes} daily, ${r.mocNotes} MOC, ${r.systemNotes} system) + ${r.attachments} attachments`,
    );
    console.log(
      `           ${r.wikilinks} wikilinks (${r.unresolvedTargets} unresolved), ${r.externalUrls} URLs, ${r.notesWithFrontmatter} with frontmatter`,
    );
    console.log(`           wrote ${outDir}`);
  });

// ---------- scale-render ----------
cli
  .command('scale-render', 'Render benchmark-scaling.md from per-size benchmark JSONs.')
  .option('--dir <dir>', 'Scaling reports dir (subdirs named by note count).', {
    default: `${FIXTURES}/baseline-reports/scaling`,
  })
  .action(async (opts) => {
    const dir = resolve(opts.dir);
    const subdirs = (await readdir(dir, { withFileTypes: true })).filter(
      (e) => e.isDirectory() && /^\d+$/.test(e.name),
    );
    const groups: ScaleGroup[] = [];
    for (const sd of subdirs) {
      const sizeDir = join(dir, sd.name);
      const files = (await readdir(sizeDir)).filter(
        (f) => f.startsWith('benchmark-') && f.endsWith('.json'),
      );
      const summaries = await Promise.all(
        files.map(async (f) => {
          const raw = await readFile(join(sizeDir, f), 'utf8');
          return JSON.parse(raw) as import('./bench/runner.js').BenchmarkSummary;
        }),
      );
      if (summaries.length > 0) groups.push({ size: Number(sd.name), summaries });
    }
    if (groups.length === 0) {
      console.error(`scale-render: no benchmark JSONs found under ${dir}/<size>/`);
      process.exit(2);
    }
    const outPath = join(dir, 'benchmark-scaling.md');
    await writeFile(outPath, renderScalingMarkdown(groups));
    const sizes = groups.map((g) => g.size).sort((a, b) => a - b);
    console.log(`scale-render: ${groups.length} sizes (${sizes.join(', ')}) → ${outPath}`);
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

async function buildBackend(
  name: string,
  vaultRoot?: string,
): Promise<import('./bench/backend.js').Backend> {
  if (name === 'rest') {
    const baseUrl = process.env.SEEKSTONE_REST_URL ?? 'https://127.0.0.1:27124';
    const apiKey = needArg(process.env.SEEKSTONE_REST_API_KEY, 'SEEKSTONE_REST_API_KEY env var');
    return new RestAdapter({ baseUrl, apiKey });
  }
  if (name === 'fs') {
    const root = resolve(needArg(vaultRoot, 'vault (--vault or SEEKSTONE_VAULT for fs backend)'));
    process.stderr.write(`fs: building index for ${root}…\n`);
    const adapter = await FsAdapter.build({ vaultRoot: root });
    process.stderr.write(`fs: index ready.\n`);
    return adapter;
  }
  if (name === 'mcpvault') {
    const root = resolve(
      needArg(vaultRoot, 'vault (--vault or SEEKSTONE_VAULT for mcpvault backend)'),
    );
    process.stderr.write(`mcpvault: starting subprocess for ${root}…\n`);
    const adapter = await McpvaultAdapter.build({ vaultRoot: root });
    process.stderr.write(`mcpvault: ready.\n`);
    return adapter;
  }
  if (name === 'seekstone') {
    const root = resolve(
      needArg(vaultRoot, 'vault (--vault or SEEKSTONE_VAULT for seekstone backend)'),
    );
    process.stderr.write(`seekstone: building index for ${root}…\n`);
    const adapter = await SeekstoneAdapter.build({ vaultRoot: root });
    process.stderr.write(`seekstone: index ready.\n`);
    return adapter;
  }
  if (name === 'mcp-obsidian') {
    const apiKey = needArg(
      process.env.SEEKSTONE_REST_API_KEY,
      'SEEKSTONE_REST_API_KEY env var (mcp-obsidian requires Obsidian running)',
    );
    const restUrl = new URL(process.env.SEEKSTONE_REST_URL ?? 'https://127.0.0.1:27124');
    process.stderr.write(`mcp-obsidian: starting subprocess (requires Obsidian running)…\n`);
    const adapter = await McpObsidianAdapter.build({
      apiKey,
      host: restUrl.hostname,
      port: Number(restUrl.port) || 27124,
      protocol: restUrl.protocol.replace(':', ''),
    });
    process.stderr.write(`mcp-obsidian: ready.\n`);
    return adapter;
  }
  if (name === 'obsidian-mcp') {
    const root = resolve(
      needArg(vaultRoot, 'vault (--vault or SEEKSTONE_VAULT for obsidian-mcp backend)'),
    );
    process.stderr.write(`obsidian-mcp: starting subprocess for ${root}…\n`);
    const adapter = await ObsidianMcpAdapter.build({ vaultRoot: root });
    process.stderr.write(`obsidian-mcp: ready.\n`);
    return adapter;
  }
  if (name === 'obsidian-mcp-pro') {
    const root = resolve(
      needArg(vaultRoot, 'vault (--vault or SEEKSTONE_VAULT for obsidian-mcp-pro backend)'),
    );
    process.stderr.write(`obsidian-mcp-pro: starting subprocess for ${root}…\n`);
    const adapter = await ObsidianMcpProAdapter.build({ vaultRoot: root });
    process.stderr.write(`obsidian-mcp-pro: ready.\n`);
    return adapter;
  }
  if (name === 'obsidian-mcp-server') {
    const apiKey = needArg(
      process.env.SEEKSTONE_REST_API_KEY,
      'SEEKSTONE_REST_API_KEY env var (obsidian-mcp-server requires Obsidian running)',
    );
    const baseUrl = process.env.SEEKSTONE_REST_URL ?? 'https://127.0.0.1:27124';
    process.stderr.write(`obsidian-mcp-server: starting subprocess (requires Obsidian running)…\n`);
    const adapter = await ObsidianMcpServerAdapter.build({ apiKey, baseUrl });
    process.stderr.write(`obsidian-mcp-server: ready.\n`);
    return adapter;
  }
  console.error(
    `Unknown backend: ${name}. Known: rest, fs, mcpvault, seekstone, mcp-obsidian, obsidian-mcp, obsidian-mcp-pro, obsidian-mcp-server.`,
  );
  process.exit(2);
}
