import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTicket, items, PLACEHOLDERS, section } from './factory-ticket.mjs';
import { SIZE_LIMIT } from './quality-rules.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));

// The Linear "Factory Ticket" template body, unedited.
const TEMPLATE = `## Problem

What's wrong or missing, in one or two sentences.

## Acceptance criteria

- [ ] Specific, checkable outcome
- [ ] Another one (each must be verifiable by a test or a command)

## Likely files

* \`packages/...\`

## Out of scope

What the agent must not touch or change.`;

const READY = `# SHA-999 Fix the thing

## Problem

\`list_tags\` counts tags inside code fences.

## Acceptance criteria

- [ ] A tag inside a fenced code block is not counted (test in \`list_tags.test.ts\`)
- [ ] \`npm test\` passes

## Likely files

* \`packages/server/src/tools/list_tags.ts\`

## Out of scope

The tag index format.`;

describe('checkTicket', () => {
  it('accepts a filled-in ticket', () => {
    expect(checkTicket(READY)).toEqual([]);
  });

  it('rejects the unedited template, naming every placeholder', () => {
    const problems = checkTicket(TEMPLATE);
    for (const p of PLACEHOLDERS) {
      expect(problems.some((x) => x.includes(p))).toBe(true);
    }
  });

  it('rejects one placeholder left among real criteria', () => {
    const ticket = READY.replace('- [ ] `npm test` passes', '- [ ] Specific, checkable outcome');
    expect(checkTicket(ticket)).toEqual([
      'Template placeholder left in: "Specific, checkable outcome"',
    ]);
  });

  it('rejects a ticket without acceptance criteria', () => {
    const ticket = '## Problem\n\nSomething is slow.';
    expect(checkTicket(ticket)).toEqual(['Missing a "## Acceptance criteria" section.']);
  });

  it('rejects an empty criteria section and an empty problem', () => {
    const ticket = '## Problem\n\n## Acceptance criteria\n\nTBD\n';
    expect(checkTicket(ticket)).toEqual([
      'Missing a "## Problem" section that says what is wrong.',
      '"## Acceptance criteria" has no checklist items.',
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(checkTicket(READY.replace(/\n/g, '\r\n'))).toEqual([]);
  });
  it('rejects criteria that are empty checkboxes', () => {
    const ticket = '## Problem\n\nSlow.\n\n## Acceptance criteria\n\n- [ ]\n- [x] \n';
    expect(checkTicket(ticket)).toEqual(['"## Acceptance criteria" has no checklist items.']);
  });

  it('ignores headings inside fenced code blocks', () => {
    const ticket =
      '## Problem\n\nSlow.\n\n## Acceptance criteria\n\n```md\n## Example\n```\n\n- [ ] p95 under 5 ms\n';
    expect(checkTicket(ticket)).toEqual([]);
    expect(section('```\n## Problem\n```\nnone', 'Problem')).toBeNull();
  });
});

describe('section and items', () => {
  it('reads a section up to the next heading, case-insensitively', () => {
    expect(section(READY, 'acceptance CRITERIA')).toContain('fenced code block');
    expect(section(READY, 'acceptance criteria')).not.toContain('Likely files');
    expect(section(READY, 'Nope')).toBeNull();
  });

  it('matches numbered PRD headings and longer titles', () => {
    const prd =
      '## 2. Problem & motivation\n\nSlow.\n\n## 8. Acceptance criteria\n\n- [ ] p95 under 5 ms\n';
    expect(checkTicket(prd)).toEqual([]);
    expect(section(prd, 'Problem')).toBe('Slow.');
  });

  it('collects checklist and plain bullets', () => {
    expect(items('- [ ] one\n- [x] two\n* three\ntext')).toEqual(['one', 'two', 'three']);
  });
});

describe('factory-ticket CLI', () => {
  const run = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'factory-ticket-'));
    try {
      const file = join(dir, 'ticket.md');
      writeFileSync(file, body);
      return spawnSync(process.execPath, [join(REPO, 'scripts/factory-ticket.mjs'), file], {
        encoding: 'utf8',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('exits 0 for a ready ticket and 1 with problems otherwise', () => {
    expect(run(READY).status).toBe(0);
    const r = run(TEMPLATE);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('Template placeholder left in');
  });
});

describe('factory playbook', () => {
  const skill = readFileSync(join(REPO, '.claude/skills/factory/SKILL.md'), 'utf8');

  it('names only repo paths and scripts that exist', () => {
    const paths = [
      ...skill.matchAll(/`((?:scripts|packages|\.github|\.claude)\/[^`\s*<>]+)`/g),
    ].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(existsSync(join(REPO, p)), p).toBe(true);
    for (const m of skill.matchAll(/node (scripts\/[\w-]+\.mjs)/g)) {
      expect(existsSync(join(REPO, m[1])), m[1]).toBe(true);
    }
  });

  it('states the same size limit CI enforces', () => {
    expect(skill).toContain(`${SIZE_LIMIT} changed lines`);
  });

  it('lists all nine quality rules', () => {
    const rules = section(skill, 'Quality rules') ?? '';
    expect(rules.match(/^\d+\. \*\*/gm)).toHaveLength(9);
  });
});
