#!/usr/bin/env node
// Factory log report (SHA-525). Posts one comment on the Factory log issue:
// what the factory did since the last report and what is waiting on Shaq,
// plus the five weekly metrics on Mondays (or with --weekly). Built from
// GitHub and Linear data only; no model calls.
//
//   node scripts/factory/report.mjs [--weekly] [--dry-run]
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, LINEAR_CLIENT_ID/LINEAR_CLIENT_SECRET
// (or LINEAR_API_KEY), FACTORY_LOG_ISSUE (default SHA-527),
// FACTORY_BOT_LOGIN (e.g. seekstone-factory[bot]).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linear, linearAuth } from './factory.mjs';
import { MARKER_RE } from './followup.mjs';
import { gh, ghAll } from './github.mjs';

const DAY = 24 * 60 * 60 * 1000;
const BOTS = /\[bot\]$/;

/** A finished factory.yml run, from its run name and job results. */
export function classifyRun(run) {
  const ticket = run.display_title.match(/\b([A-Z][A-Z0-9]*-\d+)\b/)?.[1] ?? '?';
  const fix = /\bfix\b/i.test(run.display_title);
  const job = (name) => run.jobs.find((j) => j.name === name);
  let outcome;
  if (run.status !== 'completed') outcome = 'running';
  else if (run.quota) outcome = 'quota';
  else if (
    // Skipped means the gate said no: prepare finished and work never ran.
    // A prepare that crashed also skips work, but that is a failure.
    run.conclusion === 'success' &&
    job('prepare')?.conclusion === 'success' &&
    job('work')?.conclusion === 'skipped' &&
    job('fix-not-started')?.conclusion !== 'success'
  ) {
    outcome = 'skipped';
  } else if (run.conclusion === 'success') outcome = 'delivered';
  else outcome = 'failed';
  return { ticket, fix, outcome, url: run.html_url, reason: run.skipReason ?? '' };
}

/** The commit a `git revert` commit undoes, from its message, or null. */
export function revertedSha(message) {
  if (!/^Revert "/.test(message)) return null;
  return message.match(/This reverts commit ([0-9a-f]{7,40})/)?.[1] ?? null;
}

const link = (pr) => `[#${pr.number}](${pr.url}) ${pr.title}`;

/** The daily comment, as Markdown. */
export function renderDaily({ since, runs, opened, merged, waiting, blocked }) {
  const out = [`**Factory log** since ${since.slice(0, 16).replace('T', ' ')} UTC`, ''];
  const done = runs.map(classifyRun);
  const count = (o) => done.filter((r) => r.outcome === o).length;
  out.push(
    `Runs: ${done.length} (${count('delivered')} delivered, ${count('skipped')} skipped, ${count('failed')} failed${count('quota') ? `, ${count('quota')} out of allowance` : ''}${count('running') ? `, ${count('running')} running` : ''}).`,
  );
  const section = (title, items) => {
    if (items.length === 0) return;
    out.push('', `**${title}**`, ...items.map((i) => `- ${i}`));
  };
  section('Waiting on you', [
    ...waiting.map((pr) => `Review ${link(pr)} (CodeRabbit: ${pr.coderabbit ?? 'not started'})`),
    ...blocked.map((t) => `Answer [${t.identifier}](${t.url}) ${t.title}: ${t.why}`),
  ]);
  section('PRs opened', opened.map(link));
  section('Merged', merged.map(link));
  section(
    'Skipped',
    done
      .filter((r) => r.outcome === 'skipped')
      .map((r) => `${r.ticket}: ${r.reason || 'see run'} ([run](${r.url}))`),
  );
  section(
    'Out of Max allowance (back in Todo for another night)',
    done
      .filter((r) => r.outcome === 'quota')
      .map((r) => `${r.ticket}${r.fix ? ' (fix)' : ''}: [run](${r.url})`),
  );
  section(
    'Failed runs',
    done
      .filter((r) => r.outcome === 'failed')
      .map((r) => `${r.ticket}${r.fix ? ' (fix)' : ''}: [run](${r.url})`),
  );
  if (done.length === 0 && waiting.length === 0 && blocked.length === 0) {
    out.push('', 'Nothing ran and nothing is waiting on you.');
  }
  return out.join('\n');
}

/**
 * The five weekly metrics.
 * - merged: factory PRs merged in the week
 * - blockRate: of the tickets the factory started this week, the share now
 *   Blocked or with a factory-blocked PR
 * - reviewRounds: human review submissions per merged PR
 * - rejected: factory PRs closed without merging, plus reverts on main
 * - speedCaught: fix attempts started because the CodSpeed check failed
 */
export function weeklyMetrics({ prs, runs, blockedTickets, reverts, markers }) {
  const merged = prs.filter((p) => p.mergedThisWeek);
  const started = new Set(
    runs
      .map(classifyRun)
      .filter((r) => !r.fix && r.outcome !== 'skipped' && r.outcome !== 'quota')
      .map((r) => r.ticket),
  );
  const blockedNow = new Set([
    ...blockedTickets,
    ...prs.filter((p) => p.labels.includes('factory-blocked')).map((p) => p.ticket),
  ]);
  const blocked = [...started].filter((t) => blockedNow.has(t)).length;
  const rounds = merged.reduce((n, p) => n + p.humanReviews, 0);
  return {
    merged: merged.length,
    started: started.size,
    blocked,
    blockRate: started.size ? blocked / started.size : 0,
    reviewRounds: merged.length ? rounds / merged.length : 0,
    rejected: prs.filter((p) => p.closedUnmergedThisWeek).length + reverts.length,
    speedCaught: markers.filter((m) => m.includes('CodSpeed Performance Analysis')).length,
  };
}

export function renderWeekly(m) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  return [
    '',
    '**Weekly metrics** (last 7 days)',
    `- Tickets merged: ${m.merged}`,
    `- Block rate: ${pct(m.blockRate)} (${m.blocked} of ${m.started} started)`,
    `- Review rounds per merged PR: ${m.reviewRounds.toFixed(1)}`,
    `- PRs rejected or reverted: ${m.rejected}`,
    `- Speed regressions caught: ${m.speedCaught}`,
  ].join('\n');
}

/** Factory PRs updated since `since`, or every open one when `since` is null. */
async function factoryPrs(repo, since) {
  const filter = since ? `state=all&since=${since}` : 'state=open';
  const issues = await ghAll(`repos/${repo}/issues?labels=factory&${filter}&per_page=100`);
  const prs = [];
  for (const i of issues.filter((x) => x.pull_request)) {
    const p = await gh(`repos/${repo}/pulls/${i.number}`);
    prs.push({
      number: p.number,
      title: p.title,
      url: p.html_url,
      draft: p.draft,
      state: p.state,
      createdAt: p.created_at,
      mergedAt: p.merged_at,
      closedAt: p.closed_at,
      headSha: p.head.sha,
      ticket: p.head.ref.match(/^factory\/([A-Z][A-Z0-9]*-\d+)/)?.[1] ?? '?',
      labels: p.labels.map((l) => l.name),
    });
  }
  return prs;
}

async function factoryRuns(repo, since) {
  const workflow_runs = await ghAll(
    `repos/${repo}/actions/workflows/factory.yml/runs?created=%3E%3D${since}&per_page=100`,
    { key: 'workflow_runs' },
  );
  for (const run of workflow_runs) {
    run.jobs = (await gh(`repos/${repo}/actions/runs/${run.id}/jobs`)).jobs;
    const prepare = run.jobs.find((j) => j.name === 'prepare');
    if (prepare) {
      const notes = await gh(`repos/${repo}/check-runs/${prepare.id}/annotations`);
      const skip = notes.find((a) => /not running/.test(a.message));
      if (skip) run.skipReason = skip.message.replace(/^.*?not running [^:]+:\s*/, '');
    }
    const deliver = run.jobs.find((j) => j.name === 'deliver');
    if (deliver?.conclusion === 'success') {
      const notes = await gh(`repos/${repo}/check-runs/${deliver.id}/annotations`);
      run.quota = notes.some((a) => /allowance ran out/.test(a.message));
    }
  }
  return workflow_runs;
}

async function blockedTickets(api) {
  const data = await api.query(
    `query { issues(filter: { labels: { name: { eqIgnoreCase: "factory" } }, state: { name: { eq: "Blocked" } } }) {
      nodes { identifier title url comments(first: 20) { nodes { body createdAt } } }
    } }`,
  );
  return data.issues.nodes.map((i) => {
    const why = i.comments.nodes
      .filter((c) => /^The factory/.test(c.body))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const firstLine = why?.body.split('\n').find((l, n) => n > 0 && l.trim()) ?? '';
    return {
      identifier: i.identifier,
      title: i.title,
      url: i.url,
      why: firstLine.trim() || 'see ticket',
    };
  });
}

async function main() {
  const weekly = process.argv.includes('--weekly') || new Date().getUTCDay() === 1;
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY;
  const now = Date.now();
  const since = new Date(now - DAY).toISOString();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  // A dry run without Linear credentials still exercises the GitHub side.
  const hasLinear =
    process.env.LINEAR_API_KEY ||
    (process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET);
  const api = hasLinear || !dryRun ? linear(await linearAuth(process.env)) : null;

  const prs = await factoryPrs(repo, weekly ? weekAgo : since);
  const runs = await factoryRuns(repo, weekly ? weekAgo : since);
  const blocked = api ? await blockedTickets(api) : [];
  // Waiting PRs have no activity cutoff: a PR nobody touched for days still waits.
  const waiting = (await factoryPrs(repo, null)).filter((p) => !p.draft);
  for (const pr of waiting) {
    const { check_runs } = await gh(
      `repos/${repo}/commits/${pr.headSha}/check-runs?check_name=CodeRabbit`,
    );
    const cr = check_runs.sort((a, b) => b.id - a.id)[0];
    pr.coderabbit = cr ? (cr.status === 'completed' ? cr.conclusion : 'reviewing') : undefined;
  }

  let body = renderDaily({
    since,
    runs: runs.filter((r) => r.created_at >= since),
    opened: prs.filter((p) => p.createdAt >= since),
    merged: prs.filter((p) => p.mergedAt && p.mergedAt >= since),
    waiting,
    blocked,
  });

  if (weekly) {
    const bot = process.env.FACTORY_BOT_LOGIN;
    const markers = [];
    for (const pr of prs) {
      pr.mergedThisWeek = Boolean(pr.mergedAt && pr.mergedAt >= weekAgo);
      pr.closedUnmergedThisWeek = Boolean(!pr.mergedAt && pr.closedAt && pr.closedAt >= weekAgo);
      const reviews = pr.mergedThisWeek ? await gh(`repos/${repo}/pulls/${pr.number}/reviews`) : [];
      pr.humanReviews = reviews.filter((r) => !BOTS.test(r.user?.login ?? '')).length;
      const comments = await gh(`repos/${repo}/issues/${pr.number}/comments?per_page=100`);
      for (const c of comments) {
        if (c.user?.login === bot && c.created_at >= weekAgo && MARKER_RE.test(c.body ?? '')) {
          markers.push(c.body);
        }
      }
    }
    // A revert names the commit it undoes; count it when that commit came
    // from a factory PR, however long ago it merged.
    const commits = await ghAll(`repos/${repo}/commits?sha=main&since=${weekAgo}&per_page=100`);
    const reverts = [];
    for (const c of commits) {
      const sha = revertedSha(c.commit.message);
      if (!sha) continue;
      const pulls = await gh(`repos/${repo}/commits/${sha}/pulls`);
      if (pulls.some((p) => p.labels.some((l) => l.name === 'factory'))) reverts.push(c);
    }
    body += `\n${renderWeekly(
      weeklyMetrics({
        prs,
        runs,
        blockedTickets: blocked.map((b) => b.identifier),
        reverts,
        markers,
      }),
    )}`;
  }

  if (dryRun) {
    console.log(body);
    return;
  }
  const log = await api.issue(process.env.FACTORY_LOG_ISSUE || 'SHA-527');
  await api.comment(log, body);
  console.log(`posted to ${log.identifier}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
