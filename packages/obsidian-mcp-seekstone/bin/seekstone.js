#!/usr/bin/env node
import { spawn } from 'node:child_process';
// obsidian-mcp-seekstone — discoverability alias for seekstone.
// Passes all arguments and env through to the real seekstone binary so
// `npx -y obsidian-mcp-seekstone` is a drop-in for `npx -y seekstone`.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Walk up from this file to find the seekstone package, checking:
// 1. Our own node_modules (installed from npm — the normal case)
// 2. The monorepo root node_modules (workspace / testing)
const thisDir = dirname(fileURLToPath(import.meta.url));

let entry;
const candidates = [
  // Installed normally: this package's own node_modules
  () => require.resolve('seekstone', { paths: [thisDir] }),
  // Workspace / monorepo: ../../.. from bin/ → obsidian-mcp-seekstone/ → packages/ → root
  () => {
    const monoRoot = join(thisDir, '..', '..', '..', 'node_modules');
    return require.resolve('seekstone', { paths: [monoRoot] });
  },
  // Fallback: node_modules adjacent to this package
  () => require.resolve('seekstone', { paths: [join(thisDir, '..', 'node_modules')] }),
];

for (const resolve of candidates) {
  try {
    entry = resolve();
    break;
  } catch {
    // try next
  }
}

if (!entry) {
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
