#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { helpText, parseCliIntent } from './cli-args.js';
import type { ServerContext } from './context.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { parseInitArgs, runInit } from './init.js';
import { createLogger } from './log.js';
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
if (intent === 'init') {
  const result = await runInit(parseInitArgs(process.argv.slice(3)), {
    env: process.env,
    platform: process.platform,
    timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
  });
  process.stdout.write(`${result.output.join('\n')}\n`);
  process.exit(result.exitCode);
}

const log = createLogger();

const vaultRoot = process.env.SEEKSTONE_VAULT;
if (!vaultRoot) {
  log.error('SEEKSTONE_VAULT env var is required');
  process.exit(1);
}

log.info('building index', { vault: vaultRoot });
const { index, notes, buildMs } = await buildIndex(vaultRoot);
log.info('index ready', { notes: notes.size, buildMs });

const ctx: ServerContext = { vaultRoot, index, notes };

const watcher = startWatcher(ctx, log);
process.on('exit', watcher.stop);

const server = new Server({ name: 'seekstone', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search',
      description:
        'Full-text search across the vault. Returns ranked excerpts (~200 chars) — not full notes — to minimise context usage. Supports fuzzy matching and prefix search.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          limit: { type: 'number', description: 'Max results (1–50, default 10).' },
          folder: { type: 'string', description: 'Restrict to a vault-relative folder prefix.' },
          tag: { type: 'string', description: 'Restrict to notes with this tag.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_note',
      description:
        'Read the full content of a specific note by its vault-relative path. Use search first to find the right path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Vault-relative path, e.g. "Daily Notes/2026-05-29.md".',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'list_notes',
      description: 'List notes, optionally filtered by folder prefix or tag.',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Vault-relative folder prefix.' },
          tag: { type: 'string', description: 'Filter by tag (# prefix optional).' },
          limit: { type: 'number', description: 'Max results (1–500, default 100).' },
        },
        required: [],
      },
    },
    {
      name: 'list_tags',
      description:
        'List all tags in the vault with usage counts. Supports substring filtering, minimum count threshold, and sort order. Nested tags (e.g. area/work) include a parent field.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description:
              'Substring filter on tag name. Example: "work" matches "work" and "area/work".',
          },
          minCount: {
            type: 'number',
            description: 'Only return tags used in at least this many notes.',
          },
          sort: {
            type: 'string',
            enum: ['count', 'name'],
            description: 'Sort by usage count descending (default) or alphabetically.',
          },
        },
        required: [],
      },
    },
    {
      name: 'create_note',
      description:
        'Create a new note at a vault-relative path. Optionally sets frontmatter and body content. Parent directories are created automatically. Fails if the note already exists unless overwrite is true.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Vault-relative path, e.g. "Daily Notes/2026-06-01.md".',
          },
          content: { type: 'string', description: 'Body content for the note.' },
          frontmatter: {
            type: 'object',
            description: 'Frontmatter key-value pairs.',
            additionalProperties: true,
          },
          overwrite: {
            type: 'boolean',
            description: 'Overwrite an existing note. Defaults to false.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'delete_note',
      description: 'Permanently delete a note from the vault. This cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path of the note to delete.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'move_note',
      description:
        'Move or rename a note to a new vault-relative path. Parent directories at the destination are created automatically. Fails if the destination already exists unless overwrite is true.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Vault-relative source path.' },
          to: { type: 'string', description: 'Vault-relative destination path.' },
          overwrite: {
            type: 'boolean',
            description: 'Overwrite destination if it exists. Defaults to false.',
          },
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'append_note',
      description:
        'Append text to a note body without touching the frontmatter. Safe for meeting notes, daily logs, and append-only workflows.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
          content: { type: 'string', description: 'Text to append.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'patch_frontmatter',
      description:
        'Set, update, or delete frontmatter keys without reordering existing keys or changing quote style. Pass null as a value to delete a key.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
          patch: {
            type: 'object',
            description: 'Key-value pairs to set. Null value removes the key.',
            additionalProperties: true,
          },
        },
        required: ['path', 'patch'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
  const { name, arguments: args } = req.params;
  return dispatch(ctx, name, args, log);
});

const transport = new StdioServerTransport();
await server.connect(transport);
log.info('ready', { tools: 9, transport: 'stdio' });

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
