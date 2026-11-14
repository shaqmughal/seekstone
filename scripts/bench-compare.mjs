// Compare two harness benchmark reports (benchmark-<backend>.json) and list
// regressions. Used by the weekly wall-clock run (SHA-519), the backstop for
// costs CodSpeed's simulation leaves out (disk I/O, system calls).
//
// A measurement regresses when its warm median or warm p95 grows by more than
// `pct` AND by more than `minMs`. The absolute floor keeps sub-millisecond
// jitter (0.04 ms → 0.05 ms is +25%) from raising false alarms.

/** Warm timings of one entry: some carry them directly, some under `stats`. */
const warmOf = (entry) => entry?.warm ?? entry?.stats?.warm;

/**
 * Every comparable measurement in a report, keyed "area/id". Tool entries
 * come in three shapes: timings on the entry (`list`), timings under `stats`
 * (`outline`, `getBacklinks`, …), or null when the backend lacks the tool.
 */
export function measurements(report) {
  const out = new Map();
  const add = (key, entry) => {
    const warm = warmOf(entry);
    if (warm) out.set(key, warm);
  };
  for (const s of report.search ?? []) add(`search/${s.id}`, s);
  for (const [id, r] of Object.entries(report.read ?? {})) add(`read/${id}`, r);
  for (const [id, t] of Object.entries(report.tools ?? {})) add(`tools/${id}`, t);
  return out;
}

/**
 * @param {object} prev  last week's report
 * @param {object} curr  this week's report
 * @param {{ pct?: number, minMs?: number }} [opts]
 * @returns {Array<{ key: string, metric: 'median' | 'p95', prev: number, curr: number, pct: number }>}
 */
export function compareBench(prev, curr, { pct = 0.1, minMs = 0.2 } = {}) {
  const before = measurements(prev);
  const regressions = [];
  for (const [key, now] of measurements(curr)) {
    const was = before.get(key);
    if (!was || !now) continue; // new or removed measurement: nothing to compare
    for (const metric of /** @type {const} */ (['median', 'p95'])) {
      const a = was[metric];
      const b = now[metric];
      if (typeof a !== 'number' || typeof b !== 'number' || a <= 0) continue;
      if (b > a * (1 + pct) && b - a > minMs) {
        regressions.push({ key, metric, prev: a, curr: b, pct: (b - a) / a });
      }
    }
  }
  return regressions;
}

/** Regressions present in both lists (same key and metric): a re-run confirms them. */
export function confirmed(first, second) {
  const again = new Set(second.map((r) => `${r.key}|${r.metric}`));
  return first.filter((r) => again.has(`${r.key}|${r.metric}`));
}

/** Markdown table for a Linear ticket or the log. */
export function renderRegressions(regressions) {
  const rows = regressions.map(
    (r) =>
      `| \`${r.key}\` | ${r.metric} | ${r.prev.toFixed(3)} | ${r.curr.toFixed(3)} | +${(r.pct * 100).toFixed(1)}% |`,
  );
  return [
    '| Measurement | Metric | Last week (ms) | This week (ms) | Change |',
    '| --- | --- | ---: | ---: | ---: |',
    ...rows,
  ].join('\n');
}
