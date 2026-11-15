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
 * The body of the first `## Heading` section whose title starts with
 * `heading` (case-insensitive, ignoring a PRD-style number like `8.`), or
 * null when absent. So `## 2. Problem & motivation` counts as `Problem`.
 */
export function section(markdown, heading) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const want = heading.toLowerCase();
  const start = lines.findIndex(
    (l) =>
      /^##\s+/.test(l) &&
      l
        .replace(/^##\s+(?:\d+[a-z]?[.)]\s*)?/, '')
        .trim()
        .toLowerCase()
        .startsWith(want),
  );
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s+/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** Checklist or bullet items in a section body. */
export function items(body) {
  return body
    .split('\n')
    .map((l) => l.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/)?.[1])
    .filter((t) => t !== undefined);
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
