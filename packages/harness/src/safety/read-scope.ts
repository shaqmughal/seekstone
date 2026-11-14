import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { McpSubprocess } from '../bench/adapters/mcp-subprocess.js';
import { copyVault } from './copy.js';

/**
 * read-scope no-leak check (SHA-291): boot the real server over stdio with
 * SEEKSTONE_READ_PATHS hiding one folder, call every tool it serves with
 * arguments that would surface the hidden note if anything leaked, and
 * require that a sentinel planted in every part of that note (title,
 * frontmatter, heading, body, tag, task) appears in zero response bytes.
 *
 * Runs on a scratch copy; the source vault is never touched. A tool the
 * server serves without a probe here fails the check, so a new tool cannot
 * ship unprobed.
 */

export const READ_SCOPE_SENTINEL = 'zzseekstonereadscopeqq';
export const HIDDEN_DIR = 'Private';
export const READ_SCOPE = `!${HIDDEN_DIR}/**`;
const HIDDEN_NOTE = `${HIDDEN_DIR}/Read Scope Sentinel.md`;

export interface ReadScopeCall {
  tool: string;
  args: Record<string, unknown>;
  isError: boolean;
  bytes: number;
}

export interface ReadScopeReport {
  scope: string;
  hiddenNote: string;
  sentinel: string;
  servedTools: string[];
  calls: ReadScopeCall[];
  /** Calls whose response contained the sentinel or named the hidden folder. */
  leaks: Array<{ tool: string; args: Record<string, unknown>; excerpt: string }>;
  /** Served tools with no probe in this check. */
  unprobed: string[];
  /** True when the hidden note's bytes survived every probe (write probes must be refused). */
  hiddenIntact: boolean;
  pass: boolean;
}

/** First note in the vault (sorted), outside dot-folders: the visible anchor. */
async function firstVisibleNote(root: string): Promise<string> {
  const all = (await readdir(root, { recursive: true })) as string[];
  const notes = all
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.md') && !p.split('/').some((s) => s.startsWith('.')))
    .sort();
  const first = notes[0];
  if (first === undefined) throw new Error('read-scope: the vault has no notes');
  return first;
}

function sentinelNote(visible: string): string {
  const s = READ_SCOPE_SENTINEL;
  const target = visible.replace(/\.md$/, '');
  return [
    '---',
    `title: ${s} title`,
    `mood: ${s} mood`,
    `tags: [${s}fm]`,
    '---',
    `# ${s} heading`,
    '',
    `Body ${s} text #${s}tag links to [[${target}]].`,
    '',
    `- [ ] ${s} task`,
    '',
  ].join('\n');
}

/** Probes keyed by tool name. Each asks for exactly what a leak would show. */
export function readScopeProbes(visible: string): Record<string, Array<Record<string, unknown>>> {
  const s = READ_SCOPE_SENTINEL;
  const h = HIDDEN_NOTE;
  return {
    search: [{ query: s }, { query: `${s} heading`, mode: 'lexical' }, { query: 'Body text' }],
    query_notes: [{}, { where: { mood: `${s} mood` } }, { tag: `${s}fm` }],
    context_pack: [{ query: s }],
    read_note: [{ path: h }],
    read_notes: [{ items: [{ path: h }, { path: visible }] }],
    list_notes: [{}, { folder: HIDDEN_DIR }],
    list_tags: [{}],
    list_tasks: [{}, { folder: HIDDEN_DIR }],
    outline_note: [{ path: h }],
    get_backlinks: [{ path: visible, includeContext: true }, { path: h }],
    get_links: [{ path: h }],
    resolve_note: [{ reference: 'Read Scope Sentinel' }, { reference: h }],
    get_periodic_note: [{}],
    list_writes: [{}],
    create_note: [{ path: h, content: 'x' }],
    delete_note: [{ path: h }],
    move_note: [{ from: h, to: 'moved-by-read-scope-check.md' }],
    rename_heading: [{ path: h, oldHeading: `${s} heading`, newHeading: 'x' }],
    append_note: [{ path: h, content: 'x' }],
    patch_frontmatter: [{ path: h, patch: { a: 1 } }],
    patch_note: [
      { path: h, target: { heading: `${s} heading` }, operation: 'append', content: 'x' },
    ],
    replace_in_note: [{ path: h, find: 'Body', replace: 'B', dryRun: true }],
    update_task: [{ path: h, line: 10, state: 'x' }],
    append_periodic_note: [{ date: '2026-01-03', content: 'read-scope probe' }],
    undo_write: [{}, { seq: 1 }],
  };
}

/** Every string inside a probe's arguments (deep). */
function argStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) argStrings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) argStrings(x, out);
  return out;
}

/**
 * Remove exact JSON-quoted echoes of the probe's own arguments (an error such
 * as `{"error":"unknown_tag","tag":"<arg>"}` repeats the input; that is not a
 * leak). Leaked note content still shows: the hidden note carries the
 * sentinel inside longer strings (title, heading, body), never as a bare
 * argument value.
 */
function withoutEchoes(text: string, args: Record<string, unknown>): string {
  let t = text;
  for (const a of argStrings(args)) t = t.replaceAll(JSON.stringify(a), '""');
  return t;
}

/**
 * Probes that would mutate the hidden note if a write slipped through. They
 * run after every read probe, so a leaky server cannot destroy the evidence
 * (e.g. trash the note) before the reads look for it.
 */
const WRITE_PROBES = new Set([
  'create_note',
  'delete_note',
  'move_note',
  'rename_heading',
  'append_note',
  'patch_frontmatter',
  'patch_note',
  'replace_in_note',
  'update_task',
  'append_periodic_note',
  'undo_write',
]);

/** Index-backed tools whose output must never name the hidden folder. */
const LISTINGS = new Set([
  'search',
  'query_notes',
  'list_notes',
  'list_tags',
  'list_tasks',
  'context_pack',
  'get_backlinks',
  'list_writes',
]);

/**
 * Run the check. `cmd` launches the server (e.g. [node, dist/index.js]);
 * `base` is the environment to inherit, minus every SEEKSTONE_* variable.
 */
export async function runReadScopeCheck(
  cmd: string[],
  srcVault: string,
  base: NodeJS.ProcessEnv = process.env,
  /** Sees every raw response; for diagnostics only, never part of the report. */
  onCall?: (call: ReadScopeCall, text: string) => void,
): Promise<ReadScopeReport> {
  const { copyRoot } = await copyVault(srcVault);
  try {
    // Every harness scratch vault carries .obsidian/ (a server without one
    // can wander off and index something else).
    await mkdir(join(copyRoot, '.obsidian'), { recursive: true });
    const visible = await firstVisibleNote(copyRoot);
    await mkdir(join(copyRoot, HIDDEN_DIR), { recursive: true });
    await writeFile(join(copyRoot, HIDDEN_NOTE), sentinelNote(visible), 'utf8');

    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined && !k.startsWith('SEEKSTONE_')) env[k] = v;
    }
    env.SEEKSTONE_VAULT = copyRoot;
    env.SEEKSTONE_CACHE_DIR = join(copyRoot, '.seekstone-cache');
    env.SEEKSTONE_READ_PATHS = READ_SCOPE;

    const [bin, ...args] = cmd;
    const sub = await McpSubprocess.connect('seekstone', [bin ?? '', ...args], {
      env,
      replaceEnv: true,
    });
    try {
      const served = (await sub.listTools()).map((t) => String(t.name)).sort();
      const ordered = [
        ...served.filter((t) => !WRITE_PROBES.has(t)),
        ...served.filter((t) => WRITE_PROBES.has(t)),
      ];
      const hiddenBefore = await readFile(join(copyRoot, HIDDEN_NOTE));
      const probes = readScopeProbes(visible);
      const calls: ReadScopeCall[] = [];
      const leaks: ReadScopeReport['leaks'] = [];
      for (const tool of ordered) {
        for (const a of probes[tool] ?? []) {
          const { text, isError } = await sub.callToolRaw(tool, a);
          const call = { tool, args: a, isError, bytes: Buffer.byteLength(text, 'utf8') };
          calls.push(call);
          onCall?.(call, text);
          const judged = withoutEchoes(text, a);
          const at = judged.indexOf(READ_SCOPE_SENTINEL);
          const namesHidden = LISTINGS.has(tool) && judged.includes(`${HIDDEN_DIR}/`);
          if (at !== -1 || namesHidden) {
            const i = at !== -1 ? at : judged.indexOf(`${HIDDEN_DIR}/`);
            leaks.push({ tool, args: a, excerpt: judged.slice(Math.max(0, i - 60), i + 60) });
          }
        }
      }
      const unprobed = served.filter((t) => !(t in probes));
      const hiddenAfter = await readFile(join(copyRoot, HIDDEN_NOTE)).catch(() => undefined);
      const hiddenIntact = hiddenAfter?.equals(hiddenBefore) === true;
      return {
        scope: READ_SCOPE,
        hiddenNote: HIDDEN_NOTE,
        sentinel: READ_SCOPE_SENTINEL,
        servedTools: served,
        calls,
        leaks,
        unprobed,
        hiddenIntact,
        pass: leaks.length === 0 && unprobed.length === 0 && hiddenIntact && served.length > 0,
      };
    } finally {
      await sub.close();
    }
  } finally {
    await rm(copyRoot, { recursive: true, force: true });
  }
}

export function renderReadScopeMarkdown(r: ReadScopeReport): string {
  const lines = [
    '# Read-scope no-leak check',
    '',
    `Scope: \`SEEKSTONE_READ_PATHS=${r.scope}\`. Hidden note: \`${r.hiddenNote}\`, with the sentinel \`${r.sentinel}\` in its title, frontmatter, heading, body, tag and task.`,
    '',
    `Result: **${r.pass ? 'PASS' : 'FAIL'}**. ${r.calls.length} calls across ${r.servedTools.length} served tools; ${r.leaks.length} leak(s); ${r.unprobed.length} unprobed tool(s); hidden note ${r.hiddenIntact ? 'intact' : 'MODIFIED'}.`,
    '',
    '| Tool | Calls | Errors | Response bytes |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const tool of r.servedTools) {
    const cs = r.calls.filter((c) => c.tool === tool);
    lines.push(
      `| \`${tool}\` | ${cs.length} | ${cs.filter((c) => c.isError).length} | ${cs.reduce((n, c) => n + c.bytes, 0)} |`,
    );
  }
  if (r.leaks.length > 0) {
    lines.push('', '## Leaks', '');
    for (const l of r.leaks)
      lines.push(`- \`${l.tool}\` ${JSON.stringify(l.args)}: …${l.excerpt}…`);
  }
  if (r.unprobed.length > 0)
    lines.push('', `Unprobed: ${r.unprobed.map((t) => `\`${t}\``).join(', ')}`);
  return `${lines.join('\n')}\n`;
}
