#!/usr/bin/env node
// Guard: every pending `.changeset/*.md` may name only the published
// `seekstone` package. See scripts/changeset-guard.mjs for the why (SHA-324).
//
// Check-only, like check-registries-tools.mjs: fails CI with an actionable
// message rather than rewriting anyone's changeset.

import { readdirSync, readFileSync } from 'node:fs';
import { checkChangeset } from './changeset-guard.mjs';

const dir = new URL('../.changeset/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');

const errors = files.flatMap((f) =>
  checkChangeset(`.changeset/${f}`, readFileSync(new URL(f, dir), 'utf8')),
);

if (errors.length > 0) {
  console.error('check-changesets: invalid changeset(s):');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check-changesets: ${files.length} pending changeset(s) OK.`);
