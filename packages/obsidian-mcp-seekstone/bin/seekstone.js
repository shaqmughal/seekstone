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

// Search ancestor node_modules directories. npm workspaces hoists seekstone
// to the monorepo root, which may be several levels above the bin file.
const searchPaths = [
  binDir,
  join(binDir, '..'),
  join(binDir, '..', '..'),
  join(binDir, '..', '..', '..'),
  join(binDir, '..', '..', '..', '..'),
].map((d) => join(d, 'node_modules'));

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
