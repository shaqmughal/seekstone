#!/usr/bin/env node
// Publish server.json to the official MCP Registry from the Release workflow.
// Expects `./mcp-publisher login github-oidc` to have run already.
//
// A version that is already listed counts as success, so a manual
// (`workflow_dispatch`) recovery run can get past this step and finish the
// release. Any other error fails the step. See mcp-registry-guard.mjs.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { classifyPublishResult } from './mcp-registry-guard.mjs';

const repoRoot = new URL('..', import.meta.url).pathname;
const { name, version } = JSON.parse(readFileSync(`${repoRoot}server.json`, 'utf8'));

const run = spawnSync('./mcp-publisher', ['publish'], { cwd: repoRoot, encoding: 'utf8' });
process.stdout.write(run.stdout ?? '');
process.stderr.write(run.stderr ?? '');

if (run.error) {
  console.error(`::error::could not run mcp-publisher: ${run.error.message}`);
  process.exit(1);
}

const result = classifyPublishResult({
  exitCode: run.status,
  output: `${run.stdout ?? ''}\n${run.stderr ?? ''}`,
  name,
  version,
});

if (result.warning) console.log(`::warning::${result.warning}`);
process.exit(result.ok ? 0 : 1);
