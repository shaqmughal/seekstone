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
    async issue(id) {
      const data = await gql(
        `query($id: String!) { issue(id: $id) {
          id identifier title description url
          state { name }
          labels { nodes { name } }
          team { states { nodes { id name } } }
          inverseRelations { nodes { type issue { identifier state { type } } } }
        } }`,
        { id },
      );
      if (!data.issue) throw new Error(`Linear: no issue ${id}`);
      return data.issue;
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

export async function blocked(id, text, api) {
  const issue = await api.issue(id);
  await api.comment(issue, `The factory stopped and needs an answer.\n\n${text.trim()}`);
  await api.moveTo(issue, 'Blocked');
}

async function main() {
  const [cmd, id, path] = process.argv.slice(2);
  if (!TICKET_ID.test(id ?? '') || !path || !['prepare', 'blocked'].includes(cmd)) {
    console.error('usage: factory.mjs prepare <ticket-id> <out-dir> | blocked <ticket-id> <file>');
    process.exit(2);
  }
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error('LINEAR_API_KEY is not set');
  const api = linear(key);

  if (cmd === 'blocked') {
    await blocked(id, readFileSync(path, 'utf8'), api);
    console.log(`${id} moved to Blocked`);
    return;
  }
  const r = await prepare(id, path, process.env, api);
  if (!r.run) {
    console.log(`::notice::not running ${id}: ${r.reason}`);
    output({ run: 'false' });
    return;
  }
  output({ run: 'true', model: r.model, branch: r.branch, labels: r.labels });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
