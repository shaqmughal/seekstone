/**
 * benchmarks-guard — "every published number equals benchmarks.json".
 *
 * Pure module (no I/O of its own) so it can be unit-tested: `checkNumbers`
 * takes the parsed benchmarks.json and a `readFile(relPath) → string`, and
 * returns a list of `file:line …` problems. scripts/check-docs-sync.mjs wires
 * it in as its fourth check.
 *
 * Strategy: a table of *anchored* expectations. Each entry names a doc surface,
 * a regex whose literal text pins the sentence or table cell the number lives
 * in, and the values benchmarks.json says the capture groups must hold. Two
 * failure modes, both loud:
 *   - the number differs            → "README.md:45 … says 6.2 but benchmarks.json says 5.2"
 *   - the anchored sentence is gone → "pattern not found — surface rewritten; update EXPECTATIONS"
 * A rewritten sentence therefore cannot silently slip out from under the guard.
 *
 * Formatting is the doc's job, not the JSON's: the helpers below reproduce the
 * README's conventions (`1.6 KB` / `47 KB` / `95 MB`, `1,550`, `47,000×`,
 * "ten guarantees") from raw values, and both sides are normalised before
 * comparison so `**5.2 ms**` and `5.2` agree.
 */

const KB = 1024;
const MB = 1024 * 1024;

// ---------- formatting (README conventions) ----------
/** One decimal: 5.2, 1.0. */
export const fmt1 = (v) => v.toFixed(1);
/** Integer with thousands separators: 1,550. */
export const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
/** Latency table cell: one decimal under 10 ms, otherwise an integer with separators. */
export const fmtMsCell = (v) => (v < 10 ? fmt1(v) : fmtInt(v));
/** Payload table cell: 1.6 KB / 47 KB / 9.8 MB / 95 MB (one decimal below 10 of the unit). */
export function fmtBytesShort(bytes) {
  const unit = bytes >= MB ? [MB, 'MB'] : [KB, 'KB'];
  const v = bytes / unit[0];
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${unit[1]}`;
}
/** Whole megabytes with one decimal: 370.9 MB. */
export const fmtMB1 = (bytes) => `${(bytes / MB).toFixed(1)} MB`;
/** Whole kilobytes rounded: 16 (KB), 2 (KB). */
export const fmtKB0 = (bytes) => String(Math.round(bytes / KB));
/** Millions with one decimal: 97.8. */
export const fmtMillions1 = (n) => (n / 1e6).toFixed(1);
/** Seconds with one decimal from milliseconds: 2.9. */
export const fmtSec1 = (ms) => (ms / 1000).toFixed(1);
/** Whole seconds / minutes from milliseconds. */
export const fmtSec0 = (ms) => String(Math.round(ms / 1000));
export const fmtMin0 = (ms) => String(Math.round(ms / 60_000));
/** Small counts as words, as the contract prose spells them. */
export function numberWord(n) {
  const words = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ];
  return words[n] ?? String(n);
}

const norm = (s) => String(s).replace(/[*~\s,]/g, '');

// ---------- markdown table helper ----------
/** Rows of the first markdown table after `heading` as `{ name, cells, line }`. */
function tableRows(text, heading) {
  const start = text.indexOf(heading);
  if (start === -1) return null;
  const lines = text.split('\n');
  const startLine = text.slice(0, start).split('\n').length - 1;
  let i = startLine;
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  const rows = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (rows.length === 0 && cells.length > 0 && !/^-+:?$/.test(cells[0]) && i === startLine)
      continue;
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator
    if (rows.length === 0 && /^Server$/i.test(cells[0])) continue; // header
    const name = cells[0]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*🥇]/gu, '')
      .trim()
      .toLowerCase();
    rows.push({ name, cells, line: i + 1 });
  }
  return rows;
}

// ---------- expectations ----------
/** Adapters that appear in the README's "8 servers" tables (everything but the harness baselines). */
const tableAdapters = (bench) =>
  Object.entries(bench.scaling.adapters).filter(
    ([, a]) => a.kind === 'seekstone' || a.kind === 'competitor',
  );

export function expectations(bench) {
  const A = bench.scaling.adapters;
  const H = bench.headline;
  const C = bench.retrieval.conditions;
  const big = bench.scaling.sizes.length - 1;
  const seek = A.seekstone;
  const d8 = C['shipped-hybrid:potion-base-8M'];
  const d32 = C['shipped-hybrid:potion-retrieval-32M'];
  const lex = C.lexical;
  const tc = C['competitor:obsidian-tc'];
  const tcg = C['competitor:obsidian-tc-graph'];
  const pro = C['competitor:obsidian-mcp-pro'];
  const competitors = tableAdapters(bench).filter(([, a]) => a.kind === 'competitor').length;
  const semMs = String(H.semanticWarmP50Ms10k.display);
  const payloadKB = fmtKB0(H.payloadBytes10k);
  const biggestMB = fmtBytesShort(H.largestMeanPayload10k.bytes);
  const tax = fmtInt(H.contextTax.display);
  const restLo = String(H.restProxyRange.display.min);
  const restHi = String(H.restProxyRange.display.max);

  return [
    // ---- README.md ----
    {
      file: 'README.md',
      label: 'headline strip semantic latency',
      re: /single-digit-ms keyword search · ~(\d+) ms semantic · ~(\d+) KB payloads · (\d+) tools/,
      expect: [semMs, payloadKB, String(bench.tools.total)],
    },
    {
      file: 'README.md',
      label: 'comparison table payload row',
      re: /\| Search payload @ 10k notes \| \*\*([\d.]+ KB)\*\* \| ([\d.]+ KB) \| up to \*\*([\d.]+ MB)\*\* \|/,
      expect: [
        fmtBytesShort(seek.payloadBytes[big]),
        fmtBytesShort(A['obsidian-mcp-server'].payloadBytes[big]),
        fmtBytesShort(A['mcp-obsidian'].payloadBytes[big]),
      ],
    },
    {
      file: 'README.md',
      label: 'comparison table latency row',
      re: /\| Warm search latency @ 10k notes \| \*\*([\d.]+) ms\*\* \| ([\d,]+) ms \(~(\d+)× slower\) \| up to ([\d,]+) ms \|/,
      expect: [
        fmt1(seek.warmMs[big]),
        fmtMsCell(A['obsidian-mcp-server'].warmMs[big]),
        String(A['obsidian-mcp-server'].vsSeekstone10k.display),
        fmtMsCell(A['mcp-obsidian'].warmMs[big]),
      ],
    },
    {
      file: 'README.md',
      label: 'speed bullet',
      re: /semantic searches in \*\*~(\d+) ms\*\* — up to \*\*~([\d,]+)× faster\*\*/,
      expect: [semMs, String(H.slowest.display)],
    },
    {
      file: 'README.md',
      label: 'context bullet',
      re: /returns \*\*~(\d+) KB\*\* via Seekstone — up to a \*\*~([\d,]+)× reduction\*\*/,
      expect: [payloadKB, tax],
    },
    {
      file: 'README.md',
      label: 'server count',
      re: /against (\d+) other Obsidian MCP servers — (\d+) servers total/,
      expect: [String(competitors), String(competitors + 1)],
    },
    {
      file: 'README.md',
      label: 'payload table',
      table: 'Search payload — bytes returned per query',
      cells: (a) => a.payloadBytes.map(fmtBytesShort),
    },
    {
      file: 'README.md',
      label: 'latency table',
      table: 'Search latency — warm mean, ms',
      cells: (a) => [
        ...a.warmMs.map(fmtMsCell),
        a.kind === 'seekstone' ? '—' : `~${a.vsSeekstone10k.display}× slower`,
      ],
    },
    {
      file: 'README.md',
      label: 'worst broad query',
      re: /hits \*\*(\d+ MB)\*\* at 10k notes, and a single broad query \(`[^`]+`\) averaged \*\*([\d.]+ MB) \/ ([\d.]+) million tokens\*\* per call across (\d+) runs\. At 10k notes that's a \*\*~([\d,]+)× context-tax difference\*\*/,
      expect: [
        biggestMB,
        fmtMB1(H.worstQuery.bytes),
        fmtMillions1(H.worstQuery.tokens),
        String(bench.scaling.runs),
        tax,
      ],
    },
    {
      file: 'README.md',
      label: 'fastest competitor + REST range',
      re: /is \*\*~(\d+)× slower\*\* warm at 10k notes with \*\*\d+× the payload\*\*, and the REST-proxy generation runs \*\*~(\d+)–(\d+)× slower\*\*/,
      expect: [String(H.fastestCompetitor.display), restLo, restHi],
    },
    {
      file: 'README.md',
      label: 'shipped semantic pipeline latency',
      re: /MaxSim rerank — lands at ~(\d+) ms\)/,
      expect: [semMs],
    },
    {
      file: 'README.md',
      label: 'semantic: default model',
      re: /scores \*\*([\d.]+)% overall hit@5, ([\d.]+)% on the held-out split\*\* \(vs ([\d.]+)% for keyword search alone\) at ~(\d+) ms warm p50/,
      expect: [fmt1(d8.overallHit5), fmt1(d8.holdoutHit5), fmt1(lex.overallHit5), semMs],
    },
    {
      file: 'README.md',
      label: 'semantic: quality model',
      re: /reaches \*\*([\d.]+)% overall hit@5, ([\d.]+)% held-out\*\* at ~(\d+) ms/,
      expect: [fmt1(d32.overallHit5), fmt1(d32.holdoutHit5), String(Math.round(d32.warmP50Ms))],
    },
    {
      file: 'README.md',
      label: 'semantic: obsidian-tc plain',
      re: /edges us on the held-out split\*\* \(([\d.]+)% vs our ([\d.]+)%\) at (\d+) ms\/query and a (\d+)-minute index vs our ~(\d+) s/,
      expect: [
        fmt1(tc.holdoutHit5),
        fmt1(d32.holdoutHit5),
        String(Math.round(tc.warmP50Ms)),
        fmtMin0(tc.indexMs),
        fmtSec0(d8.indexBuildMs),
      ],
    },
    {
      file: 'README.md',
      label: 'semantic: obsidian-tc GraphRAG',
      re: /\(([\d.]+)% held-out\), paying for it with \*\*[^*]+\*\* \(([\d.]+) s p50, ([\d.]+) s p95 — against our (\d+)–(\d+) ms\), \*\*~(\d+)× the payload\*\* \((\d+) KB vs ~(\d+) KB per query\)/,
      expect: [
        fmt1(tcg.holdoutHit5),
        fmtSec1(tcg.warmP50Ms),
        fmtSec1(tcg.warmP95Ms),
        semMs,
        String(Math.round(d32.warmP50Ms)),
        String(Math.round(tcg.payloadBytes / H.payloadBytes10k)),
        fmtKB0(tcg.payloadBytes),
        payloadKB,
      ],
    },
    {
      file: 'README.md',
      label: 'semantic: obsidian-mcp-pro failure',
      re: /string limit after ~(\d+) minutes of embedding/,
      expect: [fmtMin0(pro.indexMs)],
    },
    {
      file: 'README.md',
      label: 'guarantee count',
      re: /of \*\*(\w+) guarantees, each linked to the code/,
      expect: [numberWord(bench.guarantees.count)],
    },
    {
      file: 'README.md',
      label: 'FAQ payload reduction',
      re: /the source of the up-to-([\d,]+)× payload reduction/,
      expect: [tax],
    },
    {
      file: 'README.md',
      label: 'FAQ semantic index time',
      re: /embeds in the background after boot \(~(\d+) s at 10k notes/,
      expect: [String(Math.round(d8.indexBuildMs / 10_000) * 10)],
    },
    // ---- llms.txt ----
    {
      file: 'llms.txt',
      label: 'key facts',
      re: /against (\d+) other servers \(open-source harness, reproducible\): Seekstone returns ~(\d+) KB per search[^.]*— up to (\d+ MB) per query at 10k notes, and a single broad query averaged ([\d.]+ MB) \/ ~([\d.]+)M tokens per call\. That is up to a ~([\d,]+)× context-tax reduction\. Warm keyword-search latency is ([\d.]+) ms at 10k notes \(the shipped semantic pipeline ~(\d+) ms\) — the fastest alternative measured is ~(\d+)× slower, the REST-proxy generation ~(\d+)–(\d+)× slower\./,
      expect: [
        String(competitors),
        payloadKB,
        biggestMB,
        fmtMB1(H.worstQuery.bytes),
        fmtMillions1(H.worstQuery.tokens),
        tax,
        fmt1(seek.warmMs[big]),
        semMs,
        String(H.fastestCompetitor.display),
        restLo,
        restHi,
      ],
    },
    {
      file: 'llms.txt',
      label: 'tools heading',
      re: /^## Tools \((\d+)\)/m,
      expect: [String(bench.tools.total)],
    },
    {
      file: 'llms.txt',
      label: 'guarantee count',
      re: /of (\w+) tested guarantees/,
      expect: [numberWord(bench.guarantees.count)],
    },
    {
      file: 'llms.txt',
      label: 'semantic: seekstone models',
      re: /scores hit@5 ([\d.]+)% overall \/ ([\d.]+)% held-out \(vs ([\d.]+)% keyword-only\) at ~(\d+) ms\/query and a ~(\d+) s index; [^;]*reaches ([\d.]+)% overall \/ ([\d.]+)% held-out at ~(\d+) ms\/query/,
      expect: [
        fmt1(d8.overallHit5),
        fmt1(d8.holdoutHit5),
        fmt1(lex.overallHit5),
        semMs,
        fmtSec0(d8.indexBuildMs),
        fmt1(d32.overallHit5),
        fmt1(d32.holdoutHit5),
        String(Math.round(d32.warmP50Ms)),
      ],
    },
    {
      file: 'llms.txt',
      label: 'semantic: competitors',
      re: /edges us on the held-out split \(([\d.]+)%\) at (\d+) ms\/query and a (\d+)-minute index[^.]{0,200}?\(([\d.]+)% held-out\) at ([\d.]+) s median \/ ([\d.]+) s p95 and ~(\d+) KB payloads/,
      expect: [
        fmt1(tc.holdoutHit5),
        String(Math.round(tc.warmP50Ms)),
        fmtMin0(tc.indexMs),
        fmt1(tcg.holdoutHit5),
        fmtSec1(tcg.warmP50Ms),
        fmtSec1(tcg.warmP95Ms),
        fmtKB0(tcg.payloadBytes),
      ],
    },
    // ---- npm package surfaces ----
    {
      file: 'packages/server/package.json',
      label: 'package description',
      re: /~(\d+) ms local semantic search, ~(\d+) KB payloads, (\d+) tools/,
      expect: [semMs, payloadKB, String(bench.tools.total)],
    },
    {
      file: 'packages/server/README.md',
      label: 'intro paragraph',
      re: /\(semantic search in \*\*~(\d+) ms\*\*\) with \*\*~(\d+) KB payloads\*\*[^.]*\(up to \*\*(\d+ MB)\*\* at 10k notes\) costs ~(\d+) KB through Seekstone, up to a \*\*~([\d,]+)× reduction\*\*\. Benchmarked against (\d+) other Obsidian MCP servers/,
      expect: [semMs, payloadKB, biggestMB, payloadKB, tax, String(competitors)],
    },
    {
      file: 'packages/server/README.md',
      label: 'guarantee count',
      re: /\*\*(\w+) named guarantees/,
      expect: [numberWord(bench.guarantees.count)],
    },
    // ---- docs ----
    {
      file: 'docs/ARCHITECTURE.md',
      label: 'raw semantic scan latency',
      re: /exhaustive over every chunk, ~(\d+) ms warm at 10k notes\)/,
      expect: [String(H.semanticScanP50Ms10k.display)],
    },
  ];
}

// ---------- the check ----------
/**
 * @param bench parsed benchmarks.json
 * @param readFile (relPath) => file contents
 * @returns problems as `file:line message` strings (empty when everything matches)
 */
export function checkNumbers(bench, readFile) {
  const errors = [];
  const texts = new Map();
  const text = (f) => {
    if (!texts.has(f)) texts.set(f, readFile(f));
    return texts.get(f);
  };
  const lineOf = (t, idx) => t.slice(0, idx).split('\n').length;

  for (const e of expectations(bench)) {
    const t = text(e.file);
    if (e.table) {
      const rows = tableRows(t, e.table);
      if (!rows) {
        errors.push(
          `${e.file}: table "${e.table}" not found — surface rewritten; update EXPECTATIONS in scripts/benchmarks-guard.mjs`,
        );
        continue;
      }
      const byName = new Map(rows.map((r) => [r.name, r]));
      for (const [key, a] of tableAdapters(bench)) {
        const row = byName.get(a.label.toLowerCase()) ?? byName.get(key);
        if (!row) {
          errors.push(`${e.file}: ${e.label} has no row for ${a.label} (benchmarks.json has one)`);
          continue;
        }
        byName.delete(row.name);
        const want = e.cells(a);
        const got = row.cells.slice(-want.length);
        want.forEach((w, i) => {
          if (norm(got[i]) !== norm(w)) {
            errors.push(
              `${e.file}:${row.line} ${e.label} row "${a.label}" says ${got[i]} but benchmarks.json says ${w}`,
            );
          }
        });
      }
      for (const extra of byName.keys()) {
        errors.push(
          `${e.file}: ${e.label} has a row "${extra}" that benchmarks.json does not know`,
        );
      }
      continue;
    }
    const m = t.match(e.re);
    if (!m) {
      errors.push(
        `${e.file}: pattern for "${e.label}" not found — surface rewritten; update EXPECTATIONS in scripts/benchmarks-guard.mjs`,
      );
      continue;
    }
    const line = lineOf(t, m.index);
    m.slice(1).forEach((got, i) => {
      const want = e.expect[i];
      if (norm(got) !== norm(want)) {
        errors.push(`${e.file}:${line} "${e.label}" says ${got} but benchmarks.json says ${want}`);
      }
    });
  }
  return errors;
}

/** Number of anchored figures a clean run verifies (for the success summary). */
export function figureCount(bench) {
  return expectations(bench).reduce(
    (n, e) => n + (e.table ? tableAdapters(bench).length : e.expect.length),
    0,
  );
}
