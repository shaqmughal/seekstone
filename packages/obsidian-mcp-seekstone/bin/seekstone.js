#!/usr/bin/env node
import { spawn } from 'node:child_process';
// obsidian-mcp-seekstone — discoverability alias for seekstone.
// Passes all arguments and env through to the real seekstone binary so
// `npx -y obsidian-mcp-seekstone` is a drop-in for `npx -y seekstone`.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const binDir = dirname(fileURLToPath(import.meta.url));

// require.resolve's `paths` option takes directory paths; Node appends
// 'node_modules' itself when searching. npm workspaces hoists seekstone to
// the monorepo root, so we search ancestor directories up to 4 levels up.
const searchPaths = [
  binDir,
  join(binDir, '..'),
  join(binDir, '..', '..'),
  join(binDir, '..', '..', '..'),
  join(binDir, '..', '..', '..', '..'),
];

let entry;
try {
  entry = require.resolve('seekstone', { paths: searchPaths });
} catch {
  process.stderr.write(
    'obsidian-mcp-seekstone: seekstone is not installed.\n' + 'Run: npm install seekstone\n',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
