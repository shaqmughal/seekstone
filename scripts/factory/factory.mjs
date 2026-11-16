#!/usr/bin/env node
// Factory orchestrator (SHA-524). Runs in the factory workflow's prepare and
// deliver jobs, which hold the Linear key; the agent job never sees it.
//
//   node scripts/factory/factory.mjs prepare <ticket-id> <out-dir>
//       Checks the ticket can run, writes <out-dir>/ticket.md, moves it to
//       In Progress and writes model/branch/run outputs. A ticket that fails
//       the readiness check goes straight to Blocked without running the agent.
//   node scripts/factory/factory.mjs blocked <ticket-id> <file>
//       Comments <file> on the ticket and moves it to Blocked.
//   node scripts/factory/factory.mjs saved-branch <ticket-id> <refs-file>
//       Writes resume=<the ticket's newest factory-saved/ branch, or empty>.
//   node scripts/factory/factory.mjs stale-saved <refs-file>
//       Prints the factory-saved/ branches whose ticket is Done.
//
// Env: LINEAR_API_KEY, FACTORY_ENABLED ("true" to run), OPEN_FACTORY_PRS
// (count of open PRs labeled `factory`), GITHUB_OUTPUT (set by Actions).

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTicket } from '../factory-ticket.mjs';

export const MAX_OPEN_PRS = 5;
const LINEAR_URL = 'https://api.linear.app/graphql';
const TICKET_ID = /^[A-Z][A-Z0-9]*-\d+$/;

/** Model for a ticket, from its Linear labels (case-insensitive). */
export function pickModel(labels) {
  const has = (name) => labels.some((l) => l.toLowerCase() === name);
  if (has('factory:opus')) return 'opus';
  const codeWork = ['bug', 'feature', 'improvement'].some(has);
  if (!codeWork && (has('docs') || has('chore'))) return 'sonnet';
  return 'opus';
}

/** `factory/<ID>-<slug>` from the ticket title: lowercase ASCII words, at most 40 chars. */
export function branchName(id, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug ? `factory/${id}-${slug}` : `factory/${id}`;
}

/** GitHub labels for the PR. `bug` turns on CI's failing-test-first check. */
export function prLabels(labels) {
  return labels.some((l) => l.toLowerCase() === 'bug') ? 'factory,bug' : 'factory';
}

/** The ticket as the agent reads it: data, framed so it can't pass for instructions. */
export function ticketMarkdown(issue) {
  const labels = issue.labels.nodes.map((l) => l.name);
  return [
    `# ${issue.identifier}: ${issue.title}`,
    '',
    `Labels: ${labels.join(', ') || '(none)'}`,
    `URL: ${issue.url}`,
    '',
    issue.description ?? '',
    '',
  ].join('\n');
}

/**
 * Why this ticket can't run now, or null when it can. Checked before any
 * model time is spent.
 */
export function gate(issue, { enabled, openPrs }) {
  if (!enabled) return 'FACTORY_ENABLED is not "true".';
  if (openPrs >= MAX_OPEN_PRS) return `${openPrs} factory PRs await review (max ${MAX_OPEN_PRS}).`;
  const labels = issue.labels.nodes.map((l) => l.name.toLowerCase());
  if (!labels.includes('factory')) return `${issue.identifier} has no \`factory\` label.`;
  if (issue.state.name !== 'Todo') {
    return `${issue.identifier} is in ${issue.state.name}; only Todo tickets run.`;
  }
  const open = openBlockers(issue);
  if (open.length > 0) return `${issue.identifier} is blocked by ${open.join(', ')}.`;
  return null;
}

/** Identifiers of tickets that block this one and aren't finished (done or canceled). */
export function openBlockers(issue) {
  return (issue.inverseRelations?.nodes ?? [])
    .filter((r) => r.type === 'blocks' && !['completed', 'canceled'].includes(r.issue.state.type))
    .map((r) => r.issue.identifier);
}

/**
 * The Authorization header for Linear. With LINEAR_CLIENT_ID and
 * LINEAR_CLIENT_SECRET (the Factory OAuth app, client credentials enabled) it
 * mints a token that acts as the app, so its comments notify people; with
 * only LINEAR_API_KEY it falls back to that personal key.
 */
export async function linearAuth(env, fetchImpl = fetch) {
  if (env.LINEAR_CLIENT_ID && env.LINEAR_CLIENT_SECRET) {
    const res = await fetchImpl('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'read,write',
        client_id: env.LINEAR_CLIENT_ID,
        client_secret: env.LINEAR_CLIENT_SECRET,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      throw new Error(`Linear token: HTTP ${res.status} ${body.error ?? ''}`.trim());
    }
    return `Bearer ${body.access_token}`;
  }
  if (env.LINEAR_API_KEY) return env.LINEAR_API_KEY;
  throw new Error('set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET (or LINEAR_API_KEY)');
}

export function linear(apiKey, fetchImpl = fetch) {
  async function gql(query, variables) {
    const res = await fetchImpl(LINEAR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors) {
      throw new Error(`Linear API: HTTP ${res.status} ${JSON.stringify(body.errors ?? body)}`);
    }
    return body.data;
  }
  return {
    query: gql,
    async issue(id) {
      const data = await gql(
        `query($id: String!) { issue(id: $id) {
          id identifier title description url
          state { name type }
          labels { nodes { name } }
          team { states { nodes { id name } } }
          inverseRelations(first: 250) { nodes { type issue { identifier state { type } } } }
        } }`,
        { id },
      );
      if (!data.issue) throw new Error(`Linear: no issue ${id}`);
      return data.issue;
    },
    // Every page of Todo factory tickets. Page sizes stay small because
    // Linear multiplies nested page sizes into a query's complexity cost.
    async todoFactoryIssues() {
      const nodes = [];
      let after = null;
      do {
        const data = await gql(
          `query($after: String) { issues(first: 50, after: $after, filter: {
            labels: { name: { eqIgnoreCase: "factory" } }, state: { name: { eq: "Todo" } }
          }) {
            nodes {
              identifier priority createdAt
              inverseRelations(first: 20) { nodes { type issue { identifier state { type } } } }
            }
            pageInfo { hasNextPage endCursor }
          } }`,
          { after },
        );
        nodes.push(...data.issues.nodes);
        after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null;
      } while (after);
      return nodes;
    },
    async moveTo(issue, stateName) {
      const state = issue.team.states.nodes.find((s) => s.name === stateName);
      if (!state) throw new Error(`Linear: team has no "${stateName}" status`);
      await gql(
        'mutation($id: String!, $s: String!) { issueUpdate(id: $id, input: { stateId: $s }) { success } }',
        { id: issue.id, s: state.id },
      );
    },
    async comment(issue, body) {
      await gql(
        'mutation($id: String!, $b: String!) { commentCreate(input: { issueId: $id, body: $b }) { success } }',
        { id: issue.id, b: body },
      );
    },
  };
}

function output(pairs) {
  const lines = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  for (const l of lines) console.log(l);
}

export async function prepare(id, outDir, env, api) {
  const issue = await api.issue(id);
  const blocker = gate(issue, {
    enabled: env.FACTORY_ENABLED === 'true',
    openPrs: Number(env.OPEN_FACTORY_PRS ?? 0),
  });
  if (blocker) return { run: false, reason: blocker };

  const markdown = ticketMarkdown(issue);
  const problems = checkTicket(markdown);
  if (problems.length > 0) {
    await api.comment(
      issue,
      `The factory didn't start: this ticket isn't ready.\n\n${problems.map((p) => `- ${p}`).join('\n')}`,
    );
    await api.moveTo(issue, 'Blocked');
    return { run: false, reason: 'ticket not ready; moved to Blocked' };
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'ticket.md'), markdown);
  await api.moveTo(issue, 'In Progress');
  const labels = issue.labels.nodes.map((l) => l.name);
  return {
    run: true,
    model: pickModel(labels),
    branch: branchName(issue.identifier, issue.title),
    labels: prLabels(labels),
  };
}

/**
 * Fix mode: the ticket already has a PR, so it is In Progress or In Review,
 * not Todo. Still honours the off switch and the `factory` label.
 */
export async function prepareFix(id, outDir, env, api) {
  const issue = await api.issue(id);
  if (env.FACTORY_ENABLED !== 'true')
    return { run: false, reason: 'FACTORY_ENABLED is not "true".' };
  const labels = issue.labels.nodes.map((l) => l.name);
  if (!labels.some((l) => l.toLowerCase() === 'factory')) {
    return { run: false, reason: `${issue.identifier} has no \`factory\` label.` };
  }
  if (!['In Progress', 'In Review'].includes(issue.state.name)) {
    return { run: false, reason: `${issue.identifier} is in ${issue.state.name}.` };
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'ticket.md'), ticketMarkdown(issue));
  return {
    run: true,
    model: env.MODEL_OVERRIDE || pickModel(labels),
    labels: prLabels(labels),
  };
}

/** Move the ticket back to Blocked if something moved it (the PR is labeled factory-blocked). */
export async function ensureBlocked(id, api) {
  const issue = await api.issue(id);
  if (issue.state.name === 'Blocked') return false;
  await api.moveTo(issue, 'Blocked');
  return true;
}

/**
 * Tickets for a nightly run: Todo, labeled `factory`, no open blocker, by
 * priority (Urgent first, no priority last) then age. At most `limit`, and
 * never more than the open-PR cap leaves room for.
 */
export function selectTickets(issues, { limit, openPrs }) {
  const rank = (p) => (p === 0 ? 5 : p);
  const room = Math.max(0, Math.min(limit, MAX_OPEN_PRS - openPrs));
  return issues
    .filter((i) => openBlockers(i).length === 0)
    .sort((a, b) => rank(a.priority) - rank(b.priority) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, room)
    .map((i) => i.identifier);
}

/**
 * Whether a Claude Code stream-json transcript shows the Max allowance ran
 * out: a rejected rate-limit event, a switch to paid overage
 * (the factory spends nothing extra), or an error result about usage limits.
 */
export function quotaExhausted(transcript) {
  for (const line of transcript.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const info = e.type === 'rate_limit_event' ? e.rate_limit_info : null;
    // `allowed_warning` only means the limit is near; keep working.
    if (info && (info.status === 'rejected' || info.isUsingOverage === true)) return true;
    if (
      e.type === 'result' &&
      e.is_error &&
      /usage limit|limit reached|rate limit|out of extra usage/i.test(String(e.result ?? ''))
    ) {
      return true;
    }
  }
  return false;
}

/** Put a ticket back in Todo with a note, for a retry on a later night. */
/** `factory-saved/<ticket>-<run id>`: where deliver saves a run that opened no PR. */
const SAVED = /^(?:refs\/heads\/)?(factory-saved\/([A-Z][A-Z0-9]*-\d+)-(\d+))$/;

function parseSaved(refs) {
  return refs.flatMap((r) => {
    const m = SAVED.exec(r.trim());
    return m ? [{ branch: m[1], ticket: m[2], run: Number(m[3]) }] : [];
  });
}

/** The ticket's newest saved branch (highest run id), or null. */
export function savedBranchFor(refs, ticket) {
  const mine = parseSaved(refs).filter((s) => s.ticket === ticket);
  if (mine.length === 0) return null;
  return mine.reduce((a, b) => (b.run > a.run ? b : a)).branch;
}

/**
 * Saved branches that can go: their ticket is Done (state type `completed`).
 * Canceled, open and unknown tickets keep theirs, so no work is dropped
 * without someone deciding the ticket is finished.
 */
export function staleSavedBranches(refs, stateTypes) {
  return parseSaved(refs)
    .filter((s) => stateTypes[s.ticket] === 'completed')
    .map((s) => s.branch);
}

export async function requeue(id, text, api) {
  const issue = await api.issue(id);
  await api.comment(issue, `The factory will try again later.\n\n${text.trim()}`);
  await api.moveTo(issue, 'Todo');
}

export async function blocked(id, text, api) {
  const issue = await api.issue(id);
  await api.comment(issue, `The factory stopped and needs an answer.\n\n${text.trim()}`);
  await api.moveTo(issue, 'Blocked');
}

async function main() {
  const [cmd, id, path] = process.argv.slice(2);
  if (cmd === 'quota') {
    // Exit 0 when the allowance ran out, 1 when it didn't.
    process.exit(quotaExhausted(readFileSync(id, 'utf8')) ? 0 : 1);
  }
  if (cmd === 'saved-branch') {
    // saved-branch <ticket-id> <refs-file>: the branch to resume from, if any.
    const refs = readFileSync(path, 'utf8').split('\n');
    const branch = savedBranchFor(refs, id) ?? '';
    console.log(branch ? `resuming ${id} from ${branch}` : `no saved work for ${id}`);
    output({ resume: branch });
    return;
  }
  if (cmd === 'stale-saved') {
    // stale-saved <refs-file>: prints saved branches whose ticket is Done.
    const refs = readFileSync(id, 'utf8').split('\n');
    const tickets = [...new Set(refs.map((r) => SAVED.exec(r.trim())?.[2]).filter(Boolean))];
    const api = linear(await linearAuth(process.env));
    const stateTypes = {};
    for (const t of tickets) {
      try {
        stateTypes[t] = (await api.issue(t)).state.type;
      } catch (e) {
        console.error(`::warning::keeping saved branches of ${t}: ${e.message}`);
      }
    }
    for (const b of staleSavedBranches(refs, stateTypes)) console.log(b);
    return;
  }
  if (cmd === 'select') {
    if (process.env.FACTORY_ENABLED !== 'true') {
      console.log('::notice::FACTORY_ENABLED is not "true"; no tickets selected');
      output({ tickets: '[]' });
      return;
    }
    const api = linear(await linearAuth(process.env));
    const tickets = selectTickets(await api.todoFactoryIssues(), {
      limit: Number(process.env.FACTORY_NIGHTLY_LIMIT || 5),
      openPrs: Number(process.env.OPEN_FACTORY_PRS ?? 0),
    });
    console.log(`selected: ${tickets.join(', ') || '(none)'}`);
    output({ tickets: JSON.stringify(tickets) });
    return;
  }
  const needsPath = ['prepare', 'prepare-fix', 'blocked', 'requeue'].includes(cmd);
  if (
    !TICKET_ID.test(id ?? '') ||
    (needsPath && !path) ||
    !(needsPath || cmd === 'ensure-blocked')
  ) {
    console.error(
      'usage: factory.mjs select | prepare|prepare-fix <ticket-id> <out-dir> | blocked|requeue <ticket-id> <file> | ensure-blocked <ticket-id> | quota <transcript> | saved-branch <ticket-id> <refs-file> | stale-saved <refs-file>',
    );
    process.exit(2);
  }
  const api = linear(await linearAuth(process.env));

  if (cmd === 'requeue') {
    await requeue(id, readFileSync(path, 'utf8'), api);
    console.log(`${id} moved back to Todo`);
    return;
  }
  if (cmd === 'blocked') {
    await blocked(id, readFileSync(path, 'utf8'), api);
    console.log(`${id} moved to Blocked`);
    return;
  }
  if (cmd === 'ensure-blocked') {
    const moved = await ensureBlocked(id, api);
    console.log(moved ? `${id} moved back to Blocked` : `${id} is already Blocked`);
    return;
  }
  const r = await (cmd === 'prepare-fix' ? prepareFix : prepare)(id, path, process.env, api);
  if (!r.run) {
    console.log(`::notice::not running ${id}: ${r.reason}`);
    output({ run: 'false' });
    return;
  }
  output({
    run: 'true',
    model: r.model,
    labels: r.labels,
    ...(r.branch ? { branch: r.branch } : {}),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
