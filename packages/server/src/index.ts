#!/usr/bin/env node
import { resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { helpText, initHelpText, parseCliIntent } from './cli-args.js';
import type { ServerContext } from './context.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { parseInitArgs, runInit } from './init.js';
import { createLogger } from './log.js';
import { parseWritePolicy } from './policy.js';
import { installProcessGuards } from './process-guards.js';
import { visibleTools } from './tool-list.js';
import { startWatcher } from './watcher.js';

// Inlined at build time by tsup (see tsup.config.ts); falls back in tsx dev.
declare const __SEEKSTONE_VERSION__: string;
const VERSION = typeof __SEEKSTONE_VERSION__ === 'string' ? __SEEKSTONE_VERSION__ : '0.0.0-dev';

// CLI subcommands / flags exit before any server setup, printing to stdout
// (these are explicit invocations, not the MCP stdio session).
const intent = parseCliIntent(process.argv.slice(2));
if (intent === 'version') {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}
if (intent === 'help') {
  process.stdout.write(`${helpText(VERSION)}\n`);
  process.exit(0);
}
if (intent === 'init-help') {
  process.stdout.write(`${initHelpText(VERSION)}\n`);
  process.exit(0);
}
if (intent === 'init') {
  const result = await runInit(parseInitArgs(process.argv.slice(3)), {
    env: process.env,
    platform: process.platform,
    timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
    cwd: process.cwd(),
  });
  process.stdout.write(`${result.output.join('\n')}\n`);
  process.exit(result.exitCode);
}

const log = createLogger();

// Long-lived stdio session: keep the server alive (and its in-memory index)
// on a stray unhandled rejection rather than crashing the user's session.
installProcessGuards(log);

const rawVaultRoot = process.env.SEEKSTONE_VAULT;
if (!rawVaultRoot) {
  log.error('SEEKSTONE_VAULT env var is required');
  process.exit(1);
}
// Normalize once so the containment guard (vault-path.ts) compares against a
// canonical absolute path — a relative or trailing-slash SEEKSTONE_VAULT must
// not weaken the prefix boundary.
const vaultRoot = resolve(rawVaultRoot);

const policy = parseWritePolicy(process.env);
if (policy.readOnly) log.info('read-only mode', { env: 'SEEKSTONE_READ_ONLY' });
if (policy.writeGlobs) log.info('write paths scoped', { globs: policy.writeGlobs });

log.info('building index', { vault: vaultRoot });
const { index, notes, backlinks, buildMs } = await buildIndex(vaultRoot);
log.info('index ready', { notes: notes.size, buildMs });

const ctx: ServerContext = { vaultRoot, index, notes, backlinks, policy };

const watcher = startWatcher(ctx, log);
// Exit handlers must stay synchronous — kick off the close; nothing awaits it.
process.on('exit', () => void watcher.stop());

const server = new Server({ name: 'seekstone', version: VERSION }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: visibleTools(ctx.policy),
}));

server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
  const { name, arguments: args } = req.params;
  return dispatch(ctx, name, args, log);
});

const transport = new StdioServerTransport();
await server.connect(transport);
log.info('ready', { tools: visibleTools(ctx.policy).length, transport: 'stdio' });

process.stderr.write(
  `seekstone: add to Claude Desktop:\n${JSON.stringify(
    {
      mcpServers: {
        seekstone: {
          command: 'npx',
          args: ['-y', 'seekstone'],
          env: { SEEKSTONE_VAULT: vaultRoot },
        },
      },
    },
    null,
    2,
  )}\n`,
);
