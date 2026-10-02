#!/usr/bin/env node
// Guard: every `with:` input in .github/workflows matches the action.yml of
// the action at its pinned ref. See scripts/action-inputs-guard.mjs for the
// why (SHA-300).
//
// Check-only, like check-changesets.mjs. Needs network: each distinct
// action@ref manifest is fetched once from raw.githubusercontent.com.

import { readdirSync, readFileSync } from 'node:fs';
import { actionSteps, checkStep, manifestInputs } from './action-inputs-guard.mjs';

const dir = new URL('../.github/workflows/', import.meta.url);
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const steps = files.flatMap((f) =>
  actionSteps(`.github/workflows/${f}`, readFileSync(new URL(f, dir), 'utf8')),
);

async function fetchManifest({ owner, repo, path, ref }) {
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path ? `${path}/` : ''}`;
  for (const name of ['action.yml', 'action.yaml']) {
    const res = await fetch(base + name);
    if (res.ok) return res.text();
    if (res.status !== 404) throw new Error(`${base}${name}: HTTP ${res.status}`);
  }
  throw new Error(`no action.yml or action.yaml at ${base}`);
}

const manifests = new Map();
for (const s of steps) {
  const key = s.uses.split(/\s/)[0];
  if (!manifests.has(key)) manifests.set(key, fetchManifest(s.action).then(manifestInputs));
}

const errors = [];
for (const s of steps) {
  try {
    errors.push(...checkStep(s, await manifests.get(s.uses.split(/\s/)[0])));
  } catch (err) {
    errors.push(`${s.where}: could not read the manifest of ${s.uses}: ${err.message}`);
  }
}

if (errors.length > 0) {
  console.error('check-action-inputs: workflow inputs do not match the pinned actions:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `check-action-inputs: ${steps.length} action step(s) across ${manifests.size} pinned action(s) OK.`,
);
