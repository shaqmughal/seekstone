import { describe, expect, it } from 'vitest';
import {
  blockedTickets,
  classifyRun,
  questions,
  renderDaily,
  renderWeekly,
  revertedSha,
  weeklyMetrics,
} from './report.mjs';

const job = (name: string, conclusion: string) => ({ name, conclusion });
const run = (title: string, conclusion: string, jobs: ReturnType<typeof job>[], extra = {}) => ({
  display_title: title,
  status: 'completed',
  conclusion,
  html_url: `https://x/${title}`,
  jobs,
  ...extra,
});

const delivered = run('Factory SHA-1', 'success', [
  job('prepare', 'success'),
  job('work', 'success'),
]);
const skipped = run(
  'Factory SHA-2',
  'success',
  [job('prepare', 'success'), job('work', 'skipped')],
  {
    skipReason: 'SHA-2 is in Backlog; only Todo tickets run.',
  },
);
const failed = run('Factory SHA-3 fix', 'failure', [
  job('prepare', 'success'),
  job('work', 'failure'),
]);
const fixNotStarted = run('Factory SHA-4 fix', 'success', [
  job('prepare', 'success'),
  job('fix-not-started', 'success'),
  job('work', 'skipped'),
]);

describe('classifyRun', () => {
  it('reads the ticket and outcome', () => {
    expect(classifyRun(delivered)).toMatchObject({
      ticket: 'SHA-1',
      fix: false,
      outcome: 'delivered',
    });
    expect(classifyRun(skipped)).toMatchObject({ outcome: 'skipped' });
    expect(classifyRun(skipped).reason).toMatch(/Backlog/);
    expect(classifyRun(failed)).toMatchObject({ ticket: 'SHA-3', fix: true, outcome: 'failed' });
    expect(classifyRun({ ...delivered, status: 'in_progress' }).outcome).toBe('running');
  });

  it('reads a run that ran out of allowance', () => {
    expect(classifyRun({ ...delivered, quota: true }).outcome).toBe('quota');
    const md = renderDaily({
      since: '2026-11-15T12:00:00.000Z',
      runs: [{ ...delivered, quota: true }],
      opened: [],
      merged: [],
      waiting: [],
      blocked: [],
    });
    expect(md).toContain('1 out of allowance');
    expect(md).toContain('Out of Max allowance');
  });

  it('counts a crashed prepare as failed, not skipped', () => {
    const crashed = run('Factory SHA-8', 'failure', [
      job('prepare', 'failure'),
      job('work', 'skipped'),
    ]);
    expect(classifyRun(crashed).outcome).toBe('failed');
  });

  it('counts a fix run whose blocking step failed as failed', () => {
    const r = run('Factory SHA-9 fix', 'failure', [
      job('prepare', 'success'),
      job('fix-not-started', 'failure'),
      job('work', 'skipped'),
    ]);
    expect(classifyRun(r).outcome).toBe('failed');
  });

  it('counts a fix run that blocked its ticket as delivered, not skipped', () => {
    expect(classifyRun(fixNotStarted).outcome).toBe('delivered');
  });
});

const pr = (number: number, extra = {}) => ({
  number,
  title: `fix thing ${number}`,
  url: `https://gh/pr/${number}`,
  labels: ['factory'],
  ticket: `SHA-${number}`,
  ...extra,
});

describe('renderDaily', () => {
  it('lists what waits on Shaq first, then activity', () => {
    const md = renderDaily({
      since: '2026-11-15T12:00:00.000Z',
      runs: [delivered, skipped, failed],
      opened: [pr(10)],
      merged: [pr(9)],
      waiting: [pr(10, { coderabbit: 'success' })],
      blocked: [
        {
          identifier: 'SHA-5',
          title: 'Thing',
          url: 'https://l/5',
          questions: ['Which timeout?', 'Which file?'],
        },
        { identifier: 'SHA-6', title: 'Other', url: 'https://l/6', questions: [] },
      ],
    });
    expect(md).toContain('since 2026-11-15 12:00 UTC');
    expect(md).toContain('Runs: 3 (1 delivered, 1 skipped, 1 failed)');
    expect(md.indexOf('Waiting on you')).toBeLessThan(md.indexOf('PRs opened'));
    expect(md).toContain('Review [#10](https://gh/pr/10) fix thing 10 (CodeRabbit: success)');
    expect(md).toContain(
      [
        '- Answer [SHA-5](https://l/5) Thing:',
        '  - Which timeout?',
        '  - Which file?',
        '  - [Reply on SHA-5](https://l/5)',
      ].join('\n'),
    );
    expect(md).toContain('- Answer [SHA-6](https://l/6) Other: see ticket');
    expect(md).toContain('SHA-2: SHA-2 is in Backlog');
    expect(md).toContain('SHA-3 (fix): [run](https://x/Factory SHA-3 fix)');
  });

  it('says so when there is nothing to report', () => {
    const md = renderDaily({
      since: '2026-11-15T12:00:00.000Z',
      runs: [],
      opened: [],
      merged: [],
      waiting: [],
      blocked: [],
    });
    expect(md).toContain('Nothing ran and nothing is waiting on you.');
    expect(md).not.toContain('**PRs opened**');
  });
});

describe('blockedTickets', () => {
  const STOPPED = 'The factory stopped and needs an answer.';
  const ticket = (comments: { body: string; createdAt: string }[]) => ({
    identifier: 'SHA-560',
    title: 'Refuse writes',
    url: 'https://l/560',
    comments: { nodes: comments },
  });
  const run = async (comments: { body: string; createdAt: string }[]) => {
    const api = { query: async () => ({ issues: { nodes: [ticket(comments)] } }) };
    return (await blockedTickets(api))[0];
  };

  it('lists numbered questions from the latest factory comment, skipping a heading', async () => {
    const body = [
      STOPPED,
      '',
      '## Blocked: the scope is unclear',
      '',
      '1. Should `.trash` be refused too?',
      '   It is where Obsidian keeps deleted notes.',
      '2) Which error code do refused writes return?',
      '3. Does the check apply to moves?',
    ].join('\n');
    const t = await run([
      { body: `${STOPPED}\n\n1. An older question`, createdAt: '2026-11-20T00:00:00Z' },
      { body, createdAt: '2026-11-21T00:00:00Z' },
      { body: 'A person replied.\n\n1. Not a factory comment', createdAt: '2026-11-22T00:00:00Z' },
    ]);
    expect(t).toEqual({
      identifier: 'SHA-560',
      title: 'Refuse writes',
      url: 'https://l/560',
      questions: [
        'Should `.trash` be refused too?',
        'Which error code do refused writes return?',
        'Does the check apply to moves?',
      ],
    });
  });

  it('falls back to the bullets of a readiness comment', async () => {
    const body = [
      "The factory didn't start: this ticket isn't ready.",
      '',
      '- missing "## Acceptance criteria" section',
      '- no checkbox items under it',
    ].join('\n');
    expect((await run([{ body, createdAt: '2026-11-24T00:00:00Z' }])).questions).toEqual([
      'missing "## Acceptance criteria" section',
      'no checkbox items under it',
    ]);
  });

  it('falls back to the first paragraph that is not a heading', async () => {
    const body = `${STOPPED}\n\n# Why\n\nThe benchmark\nregressed twice.\n\nSecond paragraph.`;
    expect((await run([{ body, createdAt: '2026-11-24T00:00:00Z' }])).questions).toEqual([
      'The benchmark regressed twice.',
    ]);
  });

  it('keeps a paragraph that starts right under its heading', () => {
    expect(questions(`${STOPPED}\n\n## Why\nWhich timeout should we use?`)).toEqual([
      'Which timeout should we use?',
    ]);
    expect(questions(`${STOPPED}\n\n# A\n## B\n\nThe real text.`)).toEqual(['The real text.']);
  });

  it('keeps issue references and drops only real headings', () => {
    expect(questions(`${STOPPED}\n\nWhich issue should we use?\n#123 or #456?`)).toEqual([
      'Which issue should we use? #123 or #456?',
    ]);
    expect(questions(`${STOPPED}\n\n#123 is blocked, what now?`)).toEqual([
      '#123 is blocked, what now?',
    ]);
    expect(questions(`${STOPPED}\n\n## Why\n   ### Also\n#\n######\tSix\nThe text.`)).toEqual([
      'The text.',
    ]);
    expect(questions(`${STOPPED}\n\n####### Seven is not a heading`)).toEqual([
      '####### Seven is not a heading',
    ]);
  });

  it('cuts a long question to 200 characters', async () => {
    const body = `${STOPPED}\n\n1. ${'x'.repeat(250)}\n2. Short?`;
    const [long, short] = (await run([{ body, createdAt: '2026-11-24T00:00:00Z' }])).questions;
    expect(long).toHaveLength(200);
    expect(long).toBe(`${'x'.repeat(199)}…`);
    expect(short).toBe('Short?');
  });

  it('has no questions when only ensureBlocked moved the ticket', async () => {
    expect((await run([])).questions).toEqual([]);
    expect(questions(STOPPED)).toEqual([]);
  });
});

describe('weeklyMetrics', () => {
  it('computes the five metrics', () => {
    const m = weeklyMetrics({
      prs: [
        pr(1, { mergedThisWeek: true, humanReviews: 1 }),
        pr(2, { mergedThisWeek: true, humanReviews: 2 }),
        pr(3, { closedUnmergedThisWeek: true, humanReviews: 0 }),
        pr(4, { labels: ['factory', 'factory-blocked'], humanReviews: 0 }),
      ],
      runs: [
        run('Factory SHA-1', 'success', [job('work', 'success')]),
        run('Factory SHA-2', 'success', [job('work', 'success')]),
        run('Factory SHA-4', 'success', [job('work', 'success')]),
        run('Factory SHA-4 fix', 'success', [job('work', 'success')]),
        run('Factory SHA-6', 'success', [job('prepare', 'success'), job('work', 'skipped')]),
        run('Factory SHA-7', 'success', [job('work', 'success')]),
      ],
      blockedTickets: ['SHA-7'],
      reverts: [{}],
      markers: [
        'Required checks failed (CodSpeed Performance Analysis). Starting fix attempt 1.',
        'x',
      ],
    });
    expect(m).toEqual({
      merged: 2,
      started: 4,
      blocked: 2,
      blockRate: 0.5,
      reviewRounds: 1.5,
      rejected: 2,
      speedCaught: 1,
    });
    const md = renderWeekly(m);
    expect(md).toContain('Block rate: 50% (2 of 4 started)');
    expect(md).toContain('Review rounds per merged PR: 1.5');
  });

  it('handles an empty week without dividing by zero', () => {
    const m = weeklyMetrics({ prs: [], runs: [], blockedTickets: [], reverts: [], markers: [] });
    expect(m.blockRate).toBe(0);
    expect(m.reviewRounds).toBe(0);
  });
});

describe('revertedSha', () => {
  it('reads the reverted commit from a git revert message', () => {
    expect(revertedSha('Revert "fix: x (#457)"\n\nThis reverts commit 23795014abcdef.')).toBe(
      '23795014abcdef',
    );
    expect(revertedSha('fix: Revert "x"\n\nThis reverts commit 23795014.')).toBeNull();
    expect(revertedSha('Revert "x"')).toBeNull();
  });
});
