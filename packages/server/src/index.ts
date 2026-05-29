#!/usr/bin/env -S npx tsx
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ServerContext } from './context.js';
import { buildIndex } from './index/build.js';
import { AppendNoteInput, appendNote } from './tools/append_note.js';
import { CreateNoteInput, createNote } from './tools/create_note.js';
import { DeleteNoteInput, deleteNote } from './tools/delete_note.js';
import { ListNotesInput, listNotes } from './tools/list_notes.js';
import { MoveNoteInput, moveNote } from './tools/move_note.js';
import { PatchFrontmatterInput, patchFrontmatter } from './tools/patch_frontmatter.js';
import { ReadNoteInput, readNote } from './tools/read_note.js';
import { SearchInput, search } from './tools/search.js';
import { startWatcher } from './watcher.js';

const vaultRoot = process.env.SEEKSTONE_VAULT;
if (!vaultRoot) {
  process.stderr.write('seekstone: SEEKSTONE_VAULT env var is required.\n');
  process.exit(1);
}

process.stderr.write(`seekstone: building index for ${vaultRoot}…\n`);
const { index, notes, buildMs } = await buildIndex(vaultRoot);
process.stderr.write(`seekstone: indexed ${notes.size} notes in ${buildMs}ms.\n`);

const ctx: ServerContext = { vaultRoot, index, notes };

const stopWatcher = startWatcher(ctx);
process.on('exit', stopWatcher);

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

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case 'search': {
        const input = SearchInput.parse(args);
        const hits = search(ctx, input);
        return {
          content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }],
        };
      }
      case 'read_note': {
        const input = ReadNoteInput.parse(args);
        const result = await readNote(ctx, input);
        return {
          content: [{ type: 'text', text: result.content }],
        };
      }
      case 'list_notes': {
        const input = ListNotesInput.parse(args);
        const entries = listNotes(ctx, input);
        return {
          content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
        };
      }
      case 'create_note': {
        const input = CreateNoteInput.parse(args);
        const result = await createNote(ctx, input);
        return {
          content: [
            {
              type: 'text',
              text: `Created ${result.path} (${result.bytesWritten} bytes).`,
            },
          ],
        };
      }
      case 'delete_note': {
        const input = DeleteNoteInput.parse(args);
        await deleteNote(ctx, input);
        return {
          content: [{ type: 'text', text: `Deleted ${input.path}.` }],
        };
      }
      case 'move_note': {
        const input = MoveNoteInput.parse(args);
        const result = await moveNote(ctx, input);
        return {
          content: [{ type: 'text', text: `Moved ${result.from} → ${result.to}.` }],
        };
      }
      case 'append_note': {
        const input = AppendNoteInput.parse(args);
        const result = await appendNote(ctx, input);
        return {
          content: [
            {
              type: 'text',
              text: `Appended ${result.bytesWritten} bytes to ${result.path}.`,
            },
          ],
        };
      }
      case 'patch_frontmatter': {
        const input = PatchFrontmatterInput.parse(args);
        const result = await patchFrontmatter(ctx, input);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write(
  `seekstone: ready. Add to Claude Desktop:\n${JSON.stringify(
    {
      mcpServers: {
        seekstone: {
          command: 'npx',
          args: ['tsx', `${import.meta.dirname}/../src/index.ts`],
          env: { SEEKSTONE_VAULT: vaultRoot },
        },
      },
    },
    null,
    2,
  )}\n`,
);
