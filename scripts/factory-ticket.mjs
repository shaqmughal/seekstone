#!/usr/bin/env node
// Readiness check for a factory ticket (SHA-523). The factory playbook runs
// this before any code changes; a ticket that fails goes to Blocked with the
// listed problems as questions.
//
//   node scripts/factory-ticket.mjs <ticket.md>
//
// Exits 0 when the ticket is ready, 1 with one problem per line when it isn't.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Text from the Linear "Factory Ticket" template that means nobody filled the section in. */
export const PLACEHOLDERS = [
  "What's wrong or missing, in one or two sentences.",
  'Specific, checkable outcome',
  'Another one (each must be verifiable by a test or a command)',
  '`packages/...`',
  'What the agent must not touch or change.',
];

/**
 * For each line, whether it is part of a fenced code block (the fence lines
 * included). A fence closes only on the same character, at least as long as
 * the opener, with nothing after it (CommonMark).
 */
export function fencedLines(lines) {
  let open = null;
  return lines.map((l) => {
    const m = l.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      if (m && !(m[1][0] === '`' && m[2].includes('`'))) open = m[1];
      return open !== null;
    }
    if (m && m[1][0] === open[0] && m[1].length >= open.length && m[2].trim() === '') open = null;
    return true;
  });
}

/**
 * The body of the first `## Heading` section whose title starts with
 * `heading` (case-insensitive, ignoring a PRD-style number like `8.`), or
 * null when absent. So `## 2. Problem & motivation` counts as `Problem`.
 * Headings inside fenced code blocks are example text, not structure.
 */
export function section(markdown, heading) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const fenced = fencedLines(lines);
  const isHeading = lines.map((l, i) => !fenced[i] && /^#{1,2}\s+/.test(l));
  const want = heading.toLowerCase();
  const start = lines.findIndex(
    (l, i) =>
      isHeading[i] &&
      /^##\s+/.test(l) &&
      l
        .replace(/^##\s+(?:\d+[a-z]?[.)]\s*)?/, '')
        .trim()
        .toLowerCase()
        .startsWith(want),
  );
  if (start === -1) return null;
  const end = isHeading.findIndex((h, i) => h && i > start);
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .replace(/^\s*\n/, '') // drop leading blank lines, keep the first line's indent
    .trimEnd();
}

/**
 * Checklist or bullet items with text in a section body. Empty checkboxes
 * and bullets inside fenced examples don't count.
 */
export function items(body) {
  const lines = body.split('\n');
  const fenced = fencedLines(lines);
  return lines
    .filter((_, i) => !fenced[i])
    .map((l) =>
      l
        .match(/^\s*[-*]\s+(.*)$/)?.[1]
        .replace(/^\[[ xX]\]/, '')
        .trim(),
    )
    .filter((t) => t !== undefined && t !== '');
}

/** Problems that make a ticket not ready for the factory; empty when it is ready. */
export function checkTicket(markdown) {
  const problems = [];
  for (const p of PLACEHOLDERS) {
    if (markdown.includes(p)) problems.push(`Template placeholder left in: "${p}"`);
  }
  const problem = section(markdown, 'Problem');
  if (!problem) problems.push('Missing a "## Problem" section that says what is wrong.');
  const criteria = section(markdown, 'Acceptance criteria');
  if (criteria === null) {
    problems.push('Missing a "## Acceptance criteria" section.');
  } else if (items(criteria).length === 0) {
    problems.push('"## Acceptance criteria" has no checklist items.');
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/factory-ticket.mjs <ticket.md>');
    process.exit(2);
  }
  const problems = checkTicket(readFileSync(file, 'utf8'));
  if (problems.length === 0) {
    console.log('ticket ready');
    process.exit(0);
  }
  for (const p of problems) console.log(p);
  process.exit(1);
}
