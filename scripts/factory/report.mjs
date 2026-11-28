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
import {
  fetchReview,
  latestVerdict,
  openThreads,
  outsideDiffOnHead,
  reviewStatus,
  summaryFindings,
} from './review.mjs';

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

const SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial'];

/**
 * CodeRabbit's state on a PR's head commit, in a few words. `review` is
 * fetchReview's `{ reviews, threads }` plus the PR's issue `comments` and
 * the head commit's `checkRuns`.
 */
export function reviewState({ headSha, review }) {
  const status = reviewStatus({ ...review, headSha });
  const findings = [
    ...openThreads(review.threads),
    ...summaryFindings(review.comments),
    ...outsideDiffOnHead(review.reviews, headSha),
  ];
  // A thread from an older commit stays open after a push until it is
  // resolved, so open findings show even before CodeRabbit reviews the head.
  if (!status.reviewed && findings.length === 0) return 'not reviewed yet';
  if (findings.length > 0 || status.changesRequested) {
    const counts = new Map();
    for (const f of findings) counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
    // Named severities first, then any other label (a summary's `Low`), Unknown last.
    const rank = (s) => (s === 'Unknown' ? 6 : SEVERITIES.includes(s) ? SEVERITIES.indexOf(s) : 5);
    const parts = [...counts].sort(([a], [b]) => rank(a) - rank(b)).map(([s, n]) => `${n} ${s}`);
    return `changes requested: ${parts.join(', ') || '0'} open`;
  }
  return latestVerdict(review.reviews) === 'APPROVED' ? 'approved' : 'reviewed, no findings';
}

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
    ...waiting.map((pr) => `Review ${link(pr)} (${reviewState(pr)})`),
    ...blocked.map((t) => {
      const head = `Answer [${t.identifier}](${t.url}) ${t.title}`;
      if (!t.questions?.length) return `${head}: see ticket`;
      const subs = [...t.questions, `[Reply on ${t.identifier}](${t.url})`];
      return `${head}:\n${subs.map((q) => `  - ${q}`).join('\n')}`;
    }),
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
    'Out of Max allowance',
    done
      .filter((r) => r.outcome === 'quota')
      .map((r) =>
        r.fix
          ? `${r.ticket} (fix): Blocked, re-run it once the allowance resets ([run](${r.url}))`
          : `${r.ticket}: back in Todo, retried on a later night ([run](${r.url}))`,
      ),
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

const MAX_QUESTION = 200;
// An ATX heading: up to 3 spaces, 1-6 `#`, then whitespace or the end of the line.
// `#123` is an issue reference, not a heading.
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

/**
 * What a factory comment asks, one entry per question: the numbered items
 * (`1.` or `1)`), else the `- ` bullets, else the first paragraph after the
 * comment's first line, with heading lines left out. Only an item's first line is
 * kept, cut to 200 characters.
 */
export function questions(body) {
  const lines = body.split('\n').slice(1);
  const items = (re) => lines.flatMap((l) => re.exec(l)?.[1].trim() || []);
  let found = items(/^\s{0,3}\d+[.)]\s+(.*)$/);
  if (found.length === 0) found = items(/^\s{0,3}- (.*)$/);
  if (found.length === 0) {
    // Heading lines go; text right under a heading in the same block stays.
    const para = lines
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) =>
        p
          .split('\n')
          .filter((l) => !HEADING.test(l))
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' '),
      )
      .find(Boolean);
    found = para ? [para] : [];
  }
  return found.map((q) => (q.length > MAX_QUESTION ? `${q.slice(0, MAX_QUESTION - 1)}…` : q));
}

/** Blocked factory tickets, each with the questions from its latest factory comment. */
export async function blockedTickets(api) {
  const data = await api.query(
    `query { issues(filter: { labels: { name: { eqIgnoreCase: "factory" } }, state: { name: { eq: "Blocked" } } }) {
      nodes { identifier title url comments(first: 20) { nodes { body createdAt } } }
    } }`,
  );
  return data.issues.nodes.map((i) => {
    const latest = i.comments.nodes
      .filter((c) => /^The factory/.test(c.body))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      identifier: i.identifier,
      title: i.title,
      url: i.url,
      questions: latest ? questions(latest.body) : [],
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
    pr.review = {
      ...(await fetchReview(repo, pr.number)),
      comments: await ghAll(`repos/${repo}/issues/${pr.number}/comments?per_page=100`),
      checkRuns: (await gh(`repos/${repo}/commits/${pr.headSha}/check-runs?per_page=100`))
        .check_runs,
    };
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
