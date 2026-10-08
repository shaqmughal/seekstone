import { parseFrontmatter } from './frontmatter.js';

export interface TaskEntry {
  /** 1-based line number in the file. */
  line: number;
  /** The raw single-character checkbox marker (` `, `x`, `X`, `/`, `-`, …). */
  state: string;
  /** Task text after the `] ` separator, trimmed. */
  text: string;
  /** Text of the nearest preceding heading, if any (same text as buildOutline). */
  heading?: string;
  /** 0-based character offset of the marker char within its line. */
  col: number;
}

/**
 * A checkbox list item as Obsidian renders one: optional indent (tasks nest
 * at any depth, including past the 4-space mark — indented code blocks are
 * deliberately not recognized here), a `-`/`*`/`+` bullet, exactly one space,
 * a single-character marker, and a space or end-of-line after the `]`.
 * Custom Tasks-plugin markers are opaque single chars, not booleans.
 */
const TASK_RE = /^([ \t]*)([-*+]) \[(.)\](?: (.*))?$/;

const HEADING_RE = /^(#{1,6})\s+(.+)/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[ \t]*([^`]*)$/;

/**
 * Extract every Markdown checkbox item from a note in one pass, skipping the
 * frontmatter region and fenced code blocks (``` or ~~~, CommonMark close
 * rule: same char, at least the opener's run length, nothing else on the
 * line; an unclosed fence suppresses to end of file). A line that *is*
 * inline code starts with a backtick, so the line-anchored grammar above can
 * never match a checkbox inside an inline-code span.
 *
 * Entries are returned in ascending line order. Shared by list_tasks (via
 * the index) and update_task (fresh scan of the disk read), so the write
 * tool can only ever touch a line the read tool would have reported.
 */
export function extractTasks(raw: string): TaskEntry[] {
  const fm = parseFrontmatter(raw);
  const tasks: TaskEntry[] = [];

  let charOffset = 0;
  let heading: string | undefined;
  let fence: { char: string; len: number } | null = null;

  for (const [i, rawLine] of raw.split('\n').entries()) {
    const lineCharOffset = charOffset;
    charOffset += rawLine.length + 1; // +1 for the '\n' consumed by split

    if (lineCharOffset < fm.bodyStart) continue;

    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (fence) {
      const close = FENCE_RE.exec(line);
      if (
        close &&
        close[1]?.startsWith(fence.char) &&
        (close[1]?.length ?? 0) >= fence.len &&
        (close[2] ?? '') === ''
      ) {
        fence = null;
      }
      continue;
    }

    const open = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    if (open) {
      const marker = open[1] ?? '';
      fence = { char: marker[0] ?? '`', len: marker.length };
      continue;
    }

    const hm = HEADING_RE.exec(line);
    if (hm) {
      heading = (hm[2] ?? '').trim();
      continue;
    }

    const tm = TASK_RE.exec(line);
    if (tm) {
      const indent = tm[1] ?? '';
      tasks.push({
        line: i + 1,
        state: tm[3] ?? '',
        text: (tm[4] ?? '').trim(),
        ...(heading !== undefined ? { heading } : {}),
        col: indent.length + 3, // bullet + space + '[' precede the marker
      });
    }
  }

  return tasks;
}
