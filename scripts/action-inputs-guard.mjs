// Pure logic for scripts/check-action-inputs.mjs, split out so it can be unit
// tested (mirrors changeset-guard.mjs / benchmarks-guard.mjs).
//
// The invariant: every `with:` input a workflow passes to a pinned action is
// one that action's action.yml declares at the pinned ref, and no required
// input (one without a default) is left out. Push-only workflows like
// release.yml never run on a PR, so a Dependabot major that renames inputs
// merges green and breaks the next release. That is what changesets/action
// v1 → v2 did in #252: `version` → `version-script`, `publish` →
// `publish-script`, and so on, and six Release runs failed (SHA-300).
//
// actionlint does not catch this: it validates inputs only for a bundled list
// of popular actions, matched by tag, so SHA-pinned actions are skipped.

import { parse } from 'yaml';

/**
 * Split a step's `uses:` into the parts needed to fetch its action.yml.
 * Returns null for local (`./…`) and `docker://` actions, which have no
 * remote manifest to check against.
 */
export function parseUses(uses) {
  if (uses.startsWith('./') || uses.startsWith('docker://')) return null;
  const m = uses.match(/^([^/@\s]+)\/([^/@\s]+)((?:\/[^@\s]+)?)@(\S+)$/);
  if (!m) return null;
  const [, owner, repo, subpath, ref] = m;
  return { owner, repo, path: subpath.replace(/^\//, ''), ref };
}

/** Every step in a workflow that calls a remote action, with its `with:` inputs. */
export function actionSteps(file, workflowText) {
  const wf = parse(workflowText) ?? {};
  const steps = [];
  for (const [jobId, job] of Object.entries(wf.jobs ?? {})) {
    for (const [i, step] of (job?.steps ?? []).entries()) {
      if (typeof step?.uses !== 'string') continue;
      const action = parseUses(step.uses);
      if (!action) continue;
      steps.push({
        where: `${file} → jobs.${jobId} step "${step.name ?? step.uses.split('@')[0]}" (#${i + 1})`,
        uses: step.uses,
        action,
        inputs: Object.keys(step.with ?? {}),
      });
    }
  }
  return steps;
}

/** The declared inputs of an action.yml, keyed by lowercase name. */
export function manifestInputs(manifestText) {
  const inputs = parse(manifestText)?.inputs ?? {};
  return new Map(
    Object.entries(inputs).map(([name, spec]) => [
      name.toLowerCase(),
      { name, required: spec?.required === true && spec?.default === undefined },
    ]),
  );
}

/**
 * Check one step's inputs against its action's declared inputs. Returns a
 * list of actionable error strings (empty when the step is fine). Input names
 * compare case-insensitively, as the runner does.
 */
export function checkStep(step, declared) {
  const errors = [];
  const passed = new Set(step.inputs.map((i) => i.toLowerCase()));
  const available = [...declared.values()].map((d) => d.name).join(', ') || '(none)';
  for (const input of step.inputs) {
    if (!declared.has(input.toLowerCase())) {
      errors.push(
        `${step.where}: input "${input}" is not declared by ${step.uses}. ` +
          `Declared inputs: ${available}. If a Dependabot bump renamed it, ` +
          `update the workflow to the new name.`,
      );
    }
  }
  for (const { name, required } of declared.values()) {
    if (required && !passed.has(name.toLowerCase())) {
      errors.push(`${step.where}: required input "${name}" of ${step.uses} is not set.`);
    }
  }
  return errors;
}
