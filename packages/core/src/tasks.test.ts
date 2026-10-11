import { describe, expect, it } from 'vitest';
import { buildOutline } from './outline.js';
import { extractTasks } from './tasks.js';

/** Index into an array the test knows is populated; fails loudly instead of masking a miss. */
function at<T>(items: ArrayLike<T>, index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`expected an element at index ${index}`);
  return item;
}

describe('extractTasks', () => {
  it('finds -, *, and + checkboxes with any single-char marker', () => {
    const raw = [
      '- [ ] open',
      '- [x] done',
      '* [/] in progress',
      '+ [-] cancelled',
      '- [?] question',
      '- [X] done upper',
    ].join('\n');
    const tasks = extractTasks(raw);
    expect(tasks.map((t) => t.state)).toEqual([' ', 'x', '/', '-', '?', 'X']);
    expect(tasks.map((t) => t.text)).toEqual([
      'open',
      'done',
      'in progress',
      'cancelled',
      'question',
      'done upper',
    ]);
  });

  it('finds tasks at any indent, including tabs and deep nesting', () => {
    const raw = [
      '- [ ] top',
      '  - [ ] two spaces',
      '    - [x] four spaces',
      '        - [ ] eight spaces',
      '\t- [ ] tab',
      '\t\t* [/] two tabs',
    ].join('\n');
    const tasks = extractTasks(raw);
    expect(tasks).toHaveLength(6);
    expect(tasks.map((t) => t.line)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reports nested tasks as individual rows', () => {
    const raw = ['- [ ] parent', '  - [x] child', '    - [ ] grandchild'].join('\n');
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['parent', 'child', 'grandchild']);
  });

  it('computes col as the marker position within the line', () => {
    const raw = ['- [ ] a', '  - [x] b', '\t- [/] c'].join('\n');
    const tasks = extractTasks(raw);
    expect(tasks.map((t) => t.col)).toEqual([3, 5, 4]);
    for (const [i, line] of raw.split('\n').entries()) {
      const task = at(tasks, i);
      expect(line[task.col]).toBe(task.state);
    }
  });

  it('rejects malformed checkbox syntax', () => {
    const raw = [
      '-[x] no space after bullet',
      '- [xx] two-char marker',
      '- [x]no space after bracket',
      '-  [x] two spaces after bullet',
      '[x] no bullet',
      '1. [x] ordered list',
    ].join('\n');
    expect(extractTasks(raw)).toEqual([]);
  });

  it('matches a bare checkbox with no text', () => {
    const tasks = extractTasks('- [ ]');
    expect(tasks).toHaveLength(1);
    expect(at(tasks, 0).text).toBe('');
  });

  it('skips checkboxes inside backtick and tilde fences', () => {
    const raw = [
      '- [ ] before',
      '```',
      '- [ ] fenced backtick',
      '```',
      '~~~',
      '- [ ] fenced tilde',
      '~~~',
      '- [ ] after',
    ].join('\n');
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['before', 'after']);
  });

  it('honors the CommonMark close rule: same char, at least opener length', () => {
    const raw = [
      '````',
      '- [ ] inside long fence',
      '```',
      '- [ ] still inside (closer too short)',
      '`````',
      '- [ ] outside',
    ].join('\n');
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['outside']);
  });

  it('does not close a fence with the other fence char', () => {
    const raw = ['```', '- [ ] inside', '~~~', '- [ ] still inside', '```', '- [ ] outside'].join(
      '\n',
    );
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['outside']);
  });

  it('suppresses to end of file on an unclosed fence', () => {
    const raw = ['- [ ] before', '```', '- [ ] fenced forever'].join('\n');
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['before']);
  });

  it('treats an indented fence inside a list as a fence', () => {
    const raw = ['- [ ] real', '  ```', '  - [ ] fenced', '  ```', '- [ ] also real'].join('\n');
    expect(extractTasks(raw).map((t) => t.text)).toEqual(['real', 'also real']);
  });

  it('ignores a line that is itself inline code', () => {
    expect(extractTasks('`- [ ] not a task`')).toEqual([]);
  });

  it('ignores checkboxes inside the frontmatter region', () => {
    const raw = ['---', 'todo: - [ ] not a task', '---', '', '- [ ] real task'].join('\n');
    const tasks = extractTasks(raw);
    expect(tasks).toHaveLength(1);
    expect(at(tasks, 0).text).toBe('real task');
    expect(at(tasks, 0).line).toBe(5);
  });

  it('attaches the nearest preceding heading, undefined before the first', () => {
    const raw = [
      '- [ ] orphan',
      '# Alpha',
      '- [ ] under alpha',
      '## Beta',
      '- [ ] under beta',
      '# Gamma',
      'prose',
      '- [ ] under gamma',
    ].join('\n');
    const tasks = extractTasks(raw);
    expect(tasks.map((t) => t.heading)).toEqual([undefined, 'Alpha', 'Beta', 'Gamma']);
  });

  it('heading text matches buildOutline for the same file', () => {
    const raw = ['---', 'title: t', '---', '# My  Heading ', '', '- [ ] a task'].join('\n');
    const outline = buildOutline(raw);
    const tasks = extractTasks(raw);
    expect(at(tasks, 0).heading).toBe(at(outline.headings, 0).text);
  });

  it('handles CRLF files: clean text and a col that points at the marker', () => {
    const raw = '# H\r\n- [ ] crlf task\r\n- [x] second\r\n';
    const tasks = extractTasks(raw);
    expect(tasks.map((t) => t.text)).toEqual(['crlf task', 'second']);
    const lines = raw.split('\n');
    for (const task of tasks) {
      expect(at(lines, task.line - 1)[task.col]).toBe(task.state);
    }
  });

  it('returns entries in ascending line order', () => {
    const raw = ['- [ ] one', 'prose', '- [x] two', '', '- [/] three'].join('\n');
    const lines = extractTasks(raw).map((t) => t.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });

  it('trims task text, including trailing hard-break spaces', () => {
    const tasks = extractTasks('- [ ]  padded text  ');
    expect(at(tasks, 0).text).toBe('padded text');
  });
});
