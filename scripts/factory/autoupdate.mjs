#!/usr/bin/env node
// Serial PR auto-update. `main` requires a PR to be up to date before it
// merges, so every merge leaves the other approved PRs behind. A maintainer
// approves a PR by turning on auto-merge; this script picks the one PR whose
// branch the workflow should update next, so approved PRs land one after
// another without anyone pressing "Update branch".
//
//   update  bring this PR's branch up to date with main
//   wait    an approved PR is already up to date and waiting on CI or about
//           to merge; updating another now would only put it behind again
//   none    nothing to do
//
// Only open, non-draft PRs into main with auto-merge on and no `needs-rebase`
// label are considered. A PR whose required checks failed is skipped, so it
// can't hold up the PRs behind it. Oldest PR (lowest number) goes first.
//
//   node scripts/factory/autoupdate.mjs
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT. The workflow does the
// update itself, with the factory app's token so CI runs on the new commit.

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requiredState } from './followup.mjs';
import { gh, ghAll, requiredChecks } from './github.mjs';

export const REBASE_LABEL = 'needs-rebase';

/** Approved PRs this script may act on: open into main, auto-merge on, not a draft, not marked for a manual rebase. */
export function candidates(pulls) {
  return pulls.filter(
    (p) =>
      p.state === 'open' &&
      p.base?.ref === 'main' &&
      p.auto_merge &&
      !p.draft &&
      !p.labels?.some((l) => l.name === REBASE_LABEL),
  );
}

/**
 * The next step, from each candidate's distance behind main and the state of
 * its required checks.
 * @param {{ number: number, headSha: string, behindBy: number, pending: string[], failed: string[] }[]} prs
 * @returns {{ action: 'update' | 'wait' | 'none', pr?: number, sha?: string, reason: string }}
 */
export function decide(prs) {
  const live = prs.filter((p) => p.failed.length === 0);
  const skipped = prs.filter((p) => p.failed.length > 0).map((p) => `#${p.number}`);
  const note = skipped.length ? `; skipped with failed checks: ${skipped.join(', ')}` : '';

  const inFlight = live.filter((p) => p.behindBy === 0).sort((a, b) => a.number - b.number)[0];
  if (inFlight) {
    const what = inFlight.pending.length ? 'waiting on CI' : 'ready to merge';
    return {
      action: 'wait',
      pr: inFlight.number,
      reason: `#${inFlight.number} is up to date and ${what}${note}`,
    };
  }

  const next = live.filter((p) => p.behindBy > 0).sort((a, b) => a.number - b.number)[0];
  if (next) {
    return {
      action: 'update',
      pr: next.number,
      sha: next.headSha,
      reason: `#${next.number} is ${next.behindBy} commit(s) behind main${note}`,
    };
  }
  return { action: 'none', reason: `no approved PR is behind main${note}` };
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const out = (pairs) => {
    const lines = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
    }
    for (const l of lines) console.log(l);
  };

  const pulls = candidates(await ghAll(`repos/${repo}/pulls?state=open&base=main&per_page=100`));
  if (pulls.length === 0) return out({ action: 'none', reason: JSON.stringify('no approved PRs') });

  const required = await requiredChecks(repo);
  const prs = [];
  for (const p of pulls) {
    const headSha = p.head.sha;
    const cmp = await gh(`repos/${repo}/compare/main...${headSha}`);
    const runs = (await gh(`repos/${repo}/commits/${headSha}/check-runs?per_page=100`)).check_runs;
    prs.push({
      number: p.number,
      headSha,
      behindBy: cmp.behind_by,
      ...requiredState(required, runs),
    });
  }

  const d = decide(prs);
  console.log(`${d.action}: ${d.reason}`);
  out({ action: d.action, pr: d.pr ?? '', sha: d.sha ?? '', reason: JSON.stringify(d.reason) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
