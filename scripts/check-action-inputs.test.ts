import { describe, expect, it } from 'vitest';
import { actionSteps, checkStep, manifestInputs, parseUses } from './action-inputs-guard.mjs';

const SHA = 'ae32849d5ba541f9ae29e40e22a623bc13562f51';

// The inputs block of changesets/action v2.1.2's action.yml, trimmed.
const CHANGESETS_V2 = `
name: Changesets
inputs:
  github-token:
    required: false
    default: \${{ github.token }}
  publish-script:
    required: false
  version-script:
    required: false
  commit-message:
    required: false
    default: "Version Packages"
  pr-title:
    required: false
    default: "Version Packages"
runs:
  using: node24
  main: dist/index.js
`;

const workflow = (withBlock: string) => `
name: Release
on: push
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: ./local-action
      - name: Create release PR or publish
        uses: changesets/action@${SHA} # v2.1.2
        with:
${withBlock}
`;

describe('action inputs guard', () => {
  it('parses owner/repo, subpath actions, and skips local and docker actions', () => {
    expect(parseUses(`changesets/action@${SHA}`)).toEqual({
      owner: 'changesets',
      repo: 'action',
      path: '',
      ref: SHA,
    });
    expect(parseUses('github/codeql-action/init@abc123')).toEqual({
      owner: 'github',
      repo: 'codeql-action',
      path: 'init',
      ref: 'abc123',
    });
    expect(parseUses('./local-action')).toBeNull();
    expect(parseUses('docker://alpine:3')).toBeNull();
  });

  it('accepts the v2 input names release.yml uses today', () => {
    const steps = actionSteps(
      'release.yml',
      workflow(`          version-script: npm run version-packages
          publish-script: npm run release
          commit-message: 'chore: version packages'
          pr-title: 'chore: version packages'
          github-token: x`),
    );
    expect(steps).toHaveLength(1);
    expect(checkStep(steps[0], manifestInputs(CHANGESETS_V2))).toEqual([]);
  });

  it('fails the v1 input names that broke six Release runs after #252', () => {
    const [step] = actionSteps(
      'release.yml',
      workflow(`          version: npm run version-packages
          publish: npm run release
          commit: 'chore: version packages'
          title: 'chore: version packages'`),
    );
    const errs = checkStep(step, manifestInputs(CHANGESETS_V2));
    expect(errs).toHaveLength(4);
    expect(errs[0]).toMatch(/release\.yml → jobs\.release step "Create release PR or publish"/);
    expect(errs[0]).toMatch(/input "version" is not declared by changesets\/action@/);
    expect(errs[0]).toMatch(/Declared inputs: github-token, publish-script, version-script/);
  });

  it('compares input names case-insensitively, as the runner does', () => {
    const [step] = actionSteps('release.yml', workflow('          PR-Title: x'));
    expect(checkStep(step, manifestInputs(CHANGESETS_V2))).toEqual([]);
  });

  it('fails a required input with no default that the step leaves out', () => {
    const manifest = `
inputs:
  app-id:
    required: true
  owner:
    required: true
    default: \${{ github.repository_owner }}
`;
    const [step] = actionSteps('release.yml', workflow('          private-key: x'));
    const errs = checkStep(step, manifestInputs(manifest));
    expect(errs).toEqual([
      expect.stringMatching(/input "private-key" is not declared/),
      expect.stringMatching(/required input "app-id" of changesets\/action@\S+ is not set\.$/),
    ]);
  });

  it('accepts a step with no inputs against an action with none', () => {
    const steps = actionSteps(
      'ci.yml',
      'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@abc\n      - run: echo hi\n',
    );
    expect(steps).toHaveLength(1);
    expect(checkStep(steps[0], manifestInputs('name: x\n'))).toEqual([]);
  });
});
