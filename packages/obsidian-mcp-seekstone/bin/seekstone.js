#!/usr/bin/env node
// obsidian-mcp-seekstone — discoverability alias for seekstone.
// Passes all arguments and env through to the real server so
// `npx -y obsidian-mcp-seekstone` is a drop-in for `npx -y seekstone`.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let entry;
try {
  entry = require.resolve('seekstone');
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
