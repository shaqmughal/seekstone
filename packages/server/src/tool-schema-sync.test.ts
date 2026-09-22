/**
 * Drift guard: the hand-written `inputSchema` each tool advertises in
 * tool-list.ts must structurally match the zod schema dispatch.ts actually
 * validates with. The two are maintained by hand in different files, and
 * they drifted silently once already (search's `excerptLength` was missing
 * from the served schema for weeks — SHA-279). Descriptions are deliberately
 * NOT compared: the served copy is tuned for LLM readers, the zod copy for
 * error messages.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ALL_TOOLS } from './tool-list.js';
import { AppendNoteInput } from './tools/append_note.js';
import { ContextPackInput } from './tools/context_pack.js';
import { CreateNoteInput } from './tools/create_note.js';
import { DeleteNoteInput } from './tools/delete_note.js';
import { GetBacklinksInput } from './tools/get_backlinks.js';
import { GetLinksInput } from './tools/get_links.js';
import { ListNotesInput } from './tools/list_notes.js';
import { ListTagsInput } from './tools/list_tags.js';
import { ListWritesInput } from './tools/list_writes.js';
import { MoveNoteInput } from './tools/move_note.js';
import { OutlineNoteInput } from './tools/outline_note.js';
import { PatchFrontmatterInput } from './tools/patch_frontmatter.js';
import { PatchNoteInput } from './tools/patch_note.js';
import { AppendPeriodicNoteInput, GetPeriodicNoteInput } from './tools/periodic_note.js';
import { QueryNotesInput } from './tools/query_notes.js';
import { ReadNoteInput } from './tools/read_note.js';
import { RenameHeadingInput } from './tools/rename_heading.js';
import { ReplaceInNoteInput } from './tools/replace_in_note.js';
import { SearchInput } from './tools/search.js';
import { UndoWriteInput } from './tools/undo_write.js';

/** Tool name → the zod schema its dispatch case parses with. */
const ZOD_INPUTS: Record<string, z.ZodType> = {
  search: SearchInput,
  query_notes: QueryNotesInput,
  context_pack: ContextPackInput,
  read_note: ReadNoteInput,
  list_notes: ListNotesInput,
  list_tags: ListTagsInput,
  create_note: CreateNoteInput,
  delete_note: DeleteNoteInput,
  move_note: MoveNoteInput,
  rename_heading: RenameHeadingInput,
  append_note: AppendNoteInput,
  patch_frontmatter: PatchFrontmatterInput,
  outline_note: OutlineNoteInput,
  patch_note: PatchNoteInput,
  get_backlinks: GetBacklinksInput,
  get_links: GetLinksInput,
  replace_in_note: ReplaceInNoteInput,
  get_periodic_note: GetPeriodicNoteInput,
  append_periodic_note: AppendPeriodicNoteInput,
  list_writes: ListWritesInput,
  undo_write: UndoWriteInput,
};

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  const?: unknown;
};

/** The served schema says `number` where zod's `.int()` emits `integer`. */
const foldType = (t: string): string => (t === 'integer' ? 'number' : t);

/**
 * The structural skeleton we hold both sides to: the JSON-schema `type`
 * (integer folded into number), enum values, array item type, and nested
 * object properties. Nullable unions collapse to their non-null branch; a
 * union of bare primitives becomes a `type: [...]` list.
 */
function skeleton(s: JsonSchema): unknown {
  const alts = s.anyOf ?? s.oneOf;
  if (alts) {
    const nonNull = alts.filter((a) => a.type !== 'null');
    if (nonNull.length === 1 && nonNull[0]) return skeleton(nonNull[0]);
    // A union of literals is an enum in the served schema.
    if (nonNull.every((a) => a.const !== undefined || a.enum)) {
      return { type: 'string', enum: nonNull.flatMap((a) => a.enum ?? [a.const]).sort() };
    }
    // A union of bare primitives is a `type: [...]` list in the served schema.
    if (nonNull.every((a) => typeof a.type === 'string' && !a.properties && !a.enum && !a.items)) {
      return { type: nonNull.map((a) => foldType(a.type as string)).sort() };
    }
    return { anyOf: nonNull.map(skeleton) };
  }
  const types = (Array.isArray(s.type) ? s.type : s.type ? [s.type] : [])
    .filter((t) => t !== 'null')
    .map(foldType)
    .sort();
  const out: Record<string, unknown> = { type: types.length === 1 ? types[0] : types };
  if (s.enum) out.enum = [...s.enum].sort();
  if (s.items) out.items = skeleton(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, skeleton(v)]),
    );
    out.required = [...(s.required ?? [])].sort();
  }
  return out;
}

function fromZod(schema: z.ZodType): unknown {
  // `io: 'input'` so defaults keep their keys optional, matching what a
  // client is required to send rather than what the handler receives.
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return skeleton(json);
}

describe('served inputSchema matches the zod schema dispatch validates with', () => {
  it('covers every tool exactly once', () => {
    expect(Object.keys(ZOD_INPUTS).sort()).toEqual(ALL_TOOLS.map((t) => t.name).sort());
  });

  for (const tool of ALL_TOOLS) {
    it(tool.name, () => {
      const zodInput = ZOD_INPUTS[tool.name];
      expect(zodInput, `${tool.name} has no zod schema registered in this test`).toBeDefined();
      if (!zodInput) return;
      expect(skeleton(tool.inputSchema as unknown as JsonSchema)).toEqual(fromZod(zodInput));
    });
  }
});
