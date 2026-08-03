import { WRITE_TOOLS } from './dispatch.js';
import type { WritePolicy } from './policy.js';

/**
 * The full tool list served to MCP clients, extracted verbatim from the
 * ListTools handler so it can be filtered by policy and unit-tested.
 * Keep in sync with HANDLED_TOOLS in dispatch.ts.
 */
export const ALL_TOOLS = [
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
    name: 'query_notes',
    description:
      'Structured metadata query — filter notes by frontmatter key/value predicates, tag, folder, modified time, and size. Returns compact rows (path + title by default; opt into more via select), not note content. Use this instead of search when filtering by properties rather than text.',
    inputSchema: {
      type: 'object',
      properties: {
        where: {
          type: 'array',
          description: 'Frontmatter predicates — all must match (AND).',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Frontmatter key to test.' },
              op: {
                type: 'string',
                enum: ['eq', 'ne', 'contains', 'exists', 'missing', 'gt', 'gte', 'lt', 'lte'],
                description:
                  'eq/ne compare scalars; contains matches array membership or substring; exists/missing test key presence; gt/gte/lt/lte compare numbers or strings (ISO dates sort correctly).',
              },
              value: {
                description: 'Comparison value. Required for every op except exists/missing.',
              },
            },
            required: ['key', 'op'],
          },
        },
        folder: { type: 'string', description: 'Restrict to a vault-relative folder prefix.' },
        tag: { type: 'string', description: 'Restrict to notes with this tag (# optional).' },
        modifiedAfter: {
          type: 'string',
          description: 'Only notes modified at or after this ISO 8601 date/time.',
        },
        modifiedBefore: {
          type: 'string',
          description: 'Only notes modified before this ISO 8601 date/time.',
        },
        minSizeBytes: { type: 'number', description: 'Only notes at least this many bytes.' },
        maxSizeBytes: { type: 'number', description: 'Only notes at most this many bytes.' },
        select: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Extra fields per hit: frontmatter keys, or "mtime", "size", "tags". Default returns only path + title.',
        },
        sort: {
          type: 'string',
          enum: ['path', 'title', 'mtime', 'size'],
          description: 'Sort field (default path).',
        },
        order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default asc).',
        },
        limit: { type: 'number', description: 'Max results (1–500, default 100).' },
      },
      required: [],
    },
  },
  {
    name: 'context_pack',
    description:
      'Assemble everything needed to ANSWER a natural-language question in one call, under a strict byte budget (default 2048): ranked excerpts, linked neighbor notes (backlinks/outlinks) with one-line summaries, and follow-up source paths. Use search to locate notes and query_notes for metadata filters; use context_pack when you want answer-ready context without multiple round-trips. Empty excerpts with confidence "none" or "low" means the vault lacks coverage — do not infer content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question or topic.' },
        budgetBytes: {
          type: 'number',
          description: 'Hard cap on response JSON bytes (256–16384, default 2048).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description:
      'Read a note or a span of it — by heading section, block reference, or line range. Returns structured JSON with the content, bytes returned, total note size, and a contentHash to pass as prevHash to edit tools for compare-and-swap. Use search or outline_note first to find the right path and section names.',
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
      'Create a new note at a vault-relative path. Optionally sets frontmatter and body content. Parent directories are created automatically. Fails if the note already exists unless overwrite is true (prevHash may guard the overwrite).',
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_note',
    description:
      'Delete a note. By default it is moved to the vault .trash/ folder (recoverable by moving it back); pass permanent: true to remove it outright.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Vault-relative path of the note to delete.' },
        permanent: {
          type: 'boolean',
          description: 'Permanently remove instead of moving to .trash/. Defaults to false.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'move_note',
    description:
      'Move or rename a note to a new vault-relative path, rewriting wikilinks and markdown links in other notes that point at it so nothing breaks (links inside fenced code blocks are left alone). Parent directories at the destination are created automatically. Fails if the destination already exists unless overwrite is true.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Vault-relative source path.' },
        to: { type: 'string', description: 'Vault-relative destination path.' },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite destination if it exists. Defaults to false.',
        },
        rewriteLinks: {
          type: 'boolean',
          description:
            'Rewrite references in other notes to follow the move. Defaults to true; pass false to move the file only.',
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
        },
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
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
          description: 'Include per-section character length in each heading entry. Default false.',
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
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
          description: 'Include a short excerpt (~200 chars) from the linking line. Default true.',
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
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
        prevHash: {
          type: 'string',
          description:
            'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
        },
      },
      required: ['content'],
    },
  },
];

/**
 * The tools visible to the client under a policy. In read-only mode write
 * tools are unregistered entirely (not just failing) — better for context
 * economy and honest about what the session can do. Dispatch still rejects
 * write calls independently; unregistering is presentation, not enforcement.
 */
export function visibleTools(policy: WritePolicy) {
  if (!policy.readOnly) return ALL_TOOLS;
  return ALL_TOOLS.filter((t) => !WRITE_TOOLS.has(t.name));
}
