import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blocked,
  branchName,
  ensureBlocked,
  gate,
  linear,
  linearAuth,
  MAX_OPEN_PRS,
  pickModel,
  prepare,
  prepareFix,
  prLabels,
  quotaExhausted,
  requeue,
  selectTickets,
  ticketMarkdown,
} from './factory.mjs';

const READY = `## Problem

Something is slow.

## Acceptance criteria

- [ ] p95 under 5 ms`;

function issue(over: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    identifier: 'SHA-9',
    title: 'Make the thing fast',
    description: READY,
    url: 'https://linear.app/x/issue/SHA-9',
    state: { name: 'Todo' },
    labels: { nodes: [{ name: 'factory' }, { name: 'Bug' }] },
    team: { states: { nodes: [] } },
    ...over,
  };
}

function fakeApi(i = issue()) {
  return {
    issue: vi.fn(async () => i),
    moveTo: vi.fn(async () => {}),
    comment: vi.fn(async () => {}),
  };
}

describe('pickModel', () => {
  it('routes docs and chores to Sonnet', () => {
    expect(pickModel(['factory', 'Chore'])).toBe('sonnet');
    expect(pickModel(['Docs'])).toBe('sonnet');
  });

  it('routes code work, and tickets without a type, to Opus', () => {
    expect(pickModel(['Bug'])).toBe('opus');
    expect(pickModel(['Chore', 'Feature'])).toBe('opus');
    expect(pickModel(['factory'])).toBe('opus');
  });

  it('lets factory:opus override everything', () => {
    expect(pickModel(['Docs', 'factory:opus'])).toBe('opus');
  });
});

describe('prLabels', () => {
  it('adds bug only for Bug tickets', () => {
    expect(prLabels(['factory', 'Bug'])).toBe('factory,bug');
    expect(prLabels(['factory', 'Chore'])).toBe('factory');
  });
});

describe('branchName', () => {
  it('builds factory/<id>-<slug>', () => {
    expect(branchName('SHA-196', 'Unit-test McpSubprocess with a stub!')).toBe(
      'factory/SHA-196-unit-test-mcpsubprocess-with-a-stub',
    );
  });

  it('caps the slug and drops characters git or a shell would trip on', () => {
    const b = branchName('SHA-1', `$(rm -rf /) ${'x'.repeat(80)}`);
    expect(b).toMatch(/^factory\/SHA-1-[a-z0-9-]+$/);
    expect(b.length).toBeLessThanOrEqual('factory/SHA-1-'.length + 40);
    expect(branchName('SHA-2', '???')).toBe('factory/SHA-2');
  });
});

describe('gate', () => {
  const ok = { enabled: true, openPrs: 0 };

  it('passes a labeled Todo ticket', () => {
    expect(gate(issue(), ok)).toBeNull();
  });

  it('stops on the off switch, the PR cap, a missing label or the wrong status', () => {
    expect(gate(issue(), { ...ok, enabled: false })).toMatch(/FACTORY_ENABLED/);
    expect(gate(issue(), { ...ok, openPrs: MAX_OPEN_PRS })).toMatch(/await review/);
    expect(gate(issue({ labels: { nodes: [{ name: 'Bug' }] } }), ok)).toMatch(/no `factory`/);
    expect(gate(issue({ state: { name: 'Backlog' } }), ok)).toMatch(/only Todo/);
  });

  it('waits for unfinished blockers and ignores finished ones and other relations', () => {
    const rel = (type: string, identifier: string, state: string) => ({
      type,
      issue: { identifier, state: { type: state } },
    });
    const blockedBy = (...nodes: ReturnType<typeof rel>[]) =>
      issue({ inverseRelations: { nodes } });
    expect(gate(blockedBy(rel('blocks', 'SHA-1', 'started')), ok)).toBe(
      'SHA-9 is blocked by SHA-1.',
    );
    expect(gate(blockedBy(rel('blocks', 'SHA-1', 'completed')), ok)).toBeNull();
    expect(gate(blockedBy(rel('blocks', 'SHA-1', 'canceled')), ok)).toBeNull();
    expect(gate(blockedBy(rel('related', 'SHA-2', 'started')), ok)).toBeNull();
  });
});

describe('ticketMarkdown', () => {
  it('includes the id, title, labels, url and description', () => {
    const md = ticketMarkdown(issue());
    expect(md).toContain('# SHA-9: Make the thing fast');
    expect(md).toContain('Labels: factory, Bug');
    expect(md).toContain('## Acceptance criteria');
  });
});

describe('prepare', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });
  const env = { FACTORY_ENABLED: 'true', OPEN_FACTORY_PRS: '0' };

  it('writes the ticket, moves it to In Progress and returns the run plan', async () => {
    dir = mkdtempSync(join(tmpdir(), 'factory-'));
    const api = fakeApi();
    const r = await prepare('SHA-9', dir, env, api);
    expect(r).toEqual({
      run: true,
      model: 'opus',
      branch: 'factory/SHA-9-make-the-thing-fast',
      labels: 'factory,bug',
    });
    expect(readFileSync(join(dir, 'ticket.md'), 'utf8')).toContain('p95 under 5 ms');
    expect(api.moveTo).toHaveBeenCalledWith(expect.anything(), 'In Progress');
  });

  it('does nothing when the gate says no', async () => {
    const api = fakeApi();
    const r = await prepare('SHA-9', '/unused', { ...env, FACTORY_ENABLED: 'false' }, api);
    expect(r.run).toBe(false);
    expect(api.moveTo).not.toHaveBeenCalled();
    expect(api.comment).not.toHaveBeenCalled();
  });

  it('blocks a ticket that fails the readiness check, without running the agent', async () => {
    const api = fakeApi(issue({ description: '## Problem\n\nSlow.' }));
    const r = await prepare('SHA-9', '/unused', env, api);
    expect(r).toEqual({ run: false, reason: 'ticket not ready; moved to Blocked' });
    expect(api.comment.mock.calls[0][1]).toContain('Acceptance criteria');
    expect(api.moveTo).toHaveBeenCalledWith(expect.anything(), 'Blocked');
  });
});

describe('blocked', () => {
  it('comments the questions and moves the ticket to Blocked', async () => {
    const api = fakeApi();
    await blocked('SHA-9', '1. Which timeout?\n', api);
    expect(api.comment.mock.calls[0][1]).toContain('1. Which timeout?');
    expect(api.moveTo).toHaveBeenCalledWith(expect.anything(), 'Blocked');
  });
});

describe('linear client', () => {
  const states = { nodes: [{ id: 's-blocked', name: 'Blocked' }] };

  it('sends the key and returns data', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: { issue: issue() } }), { status: 200 }),
    );
    const got = await linear('lin_key', fetchImpl).issue('SHA-9');
    expect(got.identifier).toBe('SHA-9');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('lin_key');
  });

  it('throws on GraphQL errors and unknown statuses', async () => {
    const errors = vi.fn(
      async () => new Response(JSON.stringify({ errors: [{ message: 'nope' }] }), { status: 200 }),
    );
    await expect(linear('k', errors).issue('SHA-9')).rejects.toThrow(/nope/);
    const api = linear('k', vi.fn());
    await expect(api.moveTo(issue({ team: { states } }), 'Done')).rejects.toThrow(/no "Done"/);
  });

  it('moves to a status by name', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { issueUpdate: { success: true } } }), {
          status: 200,
        }),
    );
    await linear('k', fetchImpl).moveTo(issue({ team: { states } }), 'Blocked');
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.variables).toEqual({ id: 'uuid-1', s: 's-blocked' });
  });
});

describe('prepareFix', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });
  const env = { FACTORY_ENABLED: 'true' };

  it('accepts an In Progress or In Review ticket and keeps its model unless overridden', async () => {
    dir = mkdtempSync(join(tmpdir(), 'factory-'));
    const api = fakeApi(issue({ state: { name: 'In Progress' } }));
    expect(await prepareFix('SHA-9', dir, env, api)).toEqual({
      run: true,
      model: 'opus',
      labels: 'factory,bug',
    });
    expect(readFileSync(join(dir, 'ticket.md'), 'utf8')).toContain('SHA-9');
    const chore = fakeApi(
      issue({
        state: { name: 'In Review' },
        labels: { nodes: [{ name: 'factory' }, { name: 'Chore' }] },
      }),
    );
    expect((await prepareFix('SHA-9', dir, { ...env, MODEL_OVERRIDE: 'opus' }, chore)).model).toBe(
      'opus',
    );
    expect(api.moveTo).not.toHaveBeenCalled();
  });

  it('refuses when switched off, unlabeled, or in another status', async () => {
    const ok = issue({ state: { name: 'In Progress' } });
    expect((await prepareFix('SHA-9', '/x', {}, fakeApi(ok))).run).toBe(false);
    expect(
      (await prepareFix('SHA-9', '/x', env, fakeApi(issue({ state: { name: 'Done' } })))).run,
    ).toBe(false);
    const noLabel = issue({ state: { name: 'In Progress' }, labels: { nodes: [] } });
    expect((await prepareFix('SHA-9', '/x', env, fakeApi(noLabel))).run).toBe(false);
  });
});

describe('ensureBlocked', () => {
  it('moves the ticket back only when it left Blocked', async () => {
    const moved = fakeApi(issue({ state: { name: 'In Review' } }));
    expect(await ensureBlocked('SHA-9', moved)).toBe(true);
    expect(moved.moveTo).toHaveBeenCalledWith(expect.anything(), 'Blocked');
    const stays = fakeApi(issue({ state: { name: 'Blocked' } }));
    expect(await ensureBlocked('SHA-9', stays)).toBe(false);
    expect(stays.moveTo).not.toHaveBeenCalled();
  });
});

describe('linearAuth', () => {
  it('mints an app token with client credentials', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 }),
    );
    const auth = await linearAuth(
      { LINEAR_CLIENT_ID: 'id', LINEAR_CLIENT_SECRET: 'sec', LINEAR_API_KEY: 'k' },
      fetchImpl,
    );
    expect(auth).toBe('Bearer tok');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.linear.app/oauth/token');
    const form = new URLSearchParams(init.body as string);
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_id')).toBe('id');
  });

  it('falls back to the personal key, and fails without either', async () => {
    expect(await linearAuth({ LINEAR_API_KEY: 'lin_x' }, vi.fn())).toBe('lin_x');
    await expect(linearAuth({}, vi.fn())).rejects.toThrow(/LINEAR_CLIENT_ID/);
  });

  it('reports a refused token request', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }),
    );
    await expect(
      linearAuth({ LINEAR_CLIENT_ID: 'id', LINEAR_CLIENT_SECRET: 'bad' }, fetchImpl),
    ).rejects.toThrow(/401 invalid_client/);
  });
});

describe('selectTickets', () => {
  const t = (identifier: string, priority: number, createdAt: string, blockers = []) => ({
    identifier,
    priority,
    createdAt,
    inverseRelations: { nodes: blockers },
  });
  const open = { type: 'blocks', issue: { identifier: 'SHA-1', state: { type: 'started' } } };
  const issues = [
    t('SHA-10', 0, '2026-01-01'),
    t('SHA-11', 3, '2026-02-01'),
    t('SHA-12', 1, '2026-03-01'),
    t('SHA-13', 3, '2026-01-15'),
    t('SHA-14', 2, '2026-01-01', [open]),
  ];

  it('orders by priority, then age, and skips blocked tickets', () => {
    expect(selectTickets(issues, { limit: 5, openPrs: 0 })).toEqual([
      'SHA-12',
      'SHA-13',
      'SHA-11',
      'SHA-10',
    ]);
  });

  it('respects the nightly limit and the open-PR cap', () => {
    expect(selectTickets(issues, { limit: 2, openPrs: 0 })).toEqual(['SHA-12', 'SHA-13']);
    expect(selectTickets(issues, { limit: 5, openPrs: 4 })).toEqual(['SHA-12']);
    expect(selectTickets(issues, { limit: 5, openPrs: 5 })).toEqual([]);
  });
});

describe('quotaExhausted', () => {
  const ev = (o: unknown) => JSON.stringify(o);
  const rate = (status: string, isUsingOverage = false) =>
    ev({ type: 'rate_limit_event', rate_limit_info: { status, isUsingOverage } });

  it('is false for a normal run', () => {
    const log = [rate('allowed'), ev({ type: 'result', is_error: false, result: 'done' })].join(
      '\n',
    );
    expect(quotaExhausted(log)).toBe(false);
  });

  it('is true when a limit was hit or paid overage started', () => {
    expect(quotaExhausted(rate('rejected'))).toBe(true);
    expect(quotaExhausted(rate('allowed', true))).toBe(true);
    expect(
      quotaExhausted(ev({ type: 'result', is_error: true, result: 'Claude usage limit reached.' })),
    ).toBe(true);
  });

  it('ignores other errors and junk lines', () => {
    expect(
      quotaExhausted(
        ['not json', ev({ type: 'result', is_error: true, result: 'tests failed' })].join('\n'),
      ),
    ).toBe(false);
  });
});

describe('requeue', () => {
  it('comments and moves the ticket back to Todo', async () => {
    const api = fakeApi();
    await requeue('SHA-9', 'Allowance ran out.', api);
    expect(api.comment.mock.calls[0][1]).toContain('Allowance ran out.');
    expect(api.moveTo).toHaveBeenCalledWith(expect.anything(), 'Todo');
  });
});
