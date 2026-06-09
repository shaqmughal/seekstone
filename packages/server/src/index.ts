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
const { index, notes, backlinks, buildMs } = await buildIndex(vaultRoot);
log.info('index ready', { notes: notes.size, buildMs });

const ctx: ServerContext = { vaultRoot, index, notes, backlinks };

const watcher = startWatcher(ctx, log);
process.on('exit', watcher.stop);

const server = new Server({ name: 'seekstone', version: VERSION }, { capabilities: { tools: {} } });

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
        'Read a note or a span of it — by heading section, block reference, or line range. Returns structured JSON with the content, bytes returned, and total note size so payload savings are measurable. Use search or outline_note first to find the right path and section names.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Vault-relative path, e.g. "Daily Notes/2026-05-29.md".',
          },
          section: {
            type: 'string',
            description:
              'Return only this heading section (heading text, # prefix optional). First match wins.',
          },
          block: {
            type: 'string',
            description: 'Return only the line anchored by this block id (^ prefix optional).',
          },
          lines: {
            type: 'object',
            description: 'Return only this line range (1-indexed, inclusive).',
            properties: {
              from: { type: 'number', description: 'First line (1-indexed).' },
              to: {
                type: 'number',
                description: 'Last line (1-indexed, inclusive). Defaults to EOF.',
              },
            },
            required: ['from'],
          },
          includeFrontmatter: {
            type: 'boolean',
            description:
              'Prepend frontmatter to section/block span results. Default false for spans.',
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
    {
      name: 'outline_note',
      description:
        "Return a note's structure — heading tree with offsets, block-reference anchors, and frontmatter key list — without returning any prose. Use this before section reads or patches to discover what sections exist at a fraction of the cost of reading the full note.",
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
          includeBlocks: {
            type: 'boolean',
            description: 'Include block-reference anchors (^id). Default true.',
          },
          includeSizes: {
            type: 'boolean',
            description:
              'Include per-section character length in each heading entry. Default false.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'patch_note',
      description:
        'Surgically edit a section of a note — targeted by heading or block reference — without rewriting the whole file. Operations: append (add after section), prepend (add after heading line), replace (swap section content). Frontmatter is never touched.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
          target: {
            type: 'object',
            description:
              'Exactly one of: { heading: "Section Title" } or { block: "block-id" } (without the ^ prefix).',
          },
          operation: {
            type: 'string',
            enum: ['append', 'prepend', 'replace'],
            description:
              'append: insert after section content. prepend: insert after heading line. replace: swap section content.',
          },
          content: { type: 'string', description: 'Content to insert or replace with.' },
          createIfMissing: {
            type: 'boolean',
            description:
              'If the heading target is not found, append a new heading (level 2) + content. Only valid for heading targets. Default false.',
          },
        },
        required: ['path', 'target', 'operation', 'content'],
      },
    },
    {
      name: 'get_backlinks',
      description:
        'Return every note that links to the target note, with the source line and an optional excerpt. Results come from the pre-built reverse-link index so this is a fast, pure index lookup. Sort order: source path ascending.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the target note.' },
          includeContext: {
            type: 'boolean',
            description:
              'Include a short excerpt (~200 chars) from the linking line. Default true.',
          },
          limit: {
            type: 'number',
            description: 'Max backlinks to return (1–500). Default 50.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_links',
      description:
        'Return all outgoing wikilinks and embeds from a note. Each link is marked resolved (with target path) or unresolved. Duplicate targets are de-duplicated; results sorted by line number.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'replace_in_note',
      description:
        'Find and replace text within a note body. Supports literal and regex search, case sensitivity, whole-word matching, and a replacement limit. Frontmatter is never touched. Use dryRun to preview matches before writing.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Vault-relative path to the note.' },
          find: { type: 'string', description: 'Text or pattern to find.' },
          replace: {
            type: 'string',
            description: 'Replacement text. Supports $1, $2, … backreferences in regex mode.',
          },
          regex: {
            type: 'boolean',
            description: 'Treat find as a regular expression. Default false.',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Case-sensitive matching. Default false.',
          },
          wholeWord: {
            type: 'boolean',
            description: 'Match whole words only (\\b boundary). Default false.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of replacements. Omit to replace all.',
          },
          dryRun: {
            type: 'boolean',
            description: 'If true, report matches without writing. Default false.',
          },
        },
        required: ['path', 'find', 'replace'],
      },
    },
    {
      name: 'get_periodic_note',
      description:
        'Get the path and existence status of a periodic note (daily, weekly, monthly, quarterly, or yearly) for a given date. Reads folder/format config from .obsidian/daily-notes.json (daily) or the periodic-notes plugin data.json. Optionally creates the note from the configured template if it is missing.',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
            description: 'Period type. Default: daily.',
          },
          date: {
            type: 'string',
            description: 'ISO date string (YYYY-MM-DD). Defaults to today when omitted.',
          },
          createIfMissing: {
            type: 'boolean',
            description:
              'Create the note from the configured template if it does not exist. Default false.',
          },
        },
        required: [],
      },
    },
    {
      name: 'append_periodic_note',
      description:
        'Append text to a periodic note (daily, weekly, monthly, quarterly, or yearly). Preserves existing frontmatter exactly. Creates the note first (from template if configured) when createIfMissing is true (default).',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
            description: 'Period type. Default: daily.',
          },
          date: {
            type: 'string',
            description: 'ISO date string (YYYY-MM-DD). Defaults to today when omitted.',
          },
          content: {
            type: 'string',
            description: 'Text to append to the note body.',
          },
          createIfMissing: {
            type: 'boolean',
            description: 'Create the note if it does not exist before appending. Default true.',
          },
        },
        required: ['content'],
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
log.info('ready', { tools: 16, transport: 'stdio' });

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
