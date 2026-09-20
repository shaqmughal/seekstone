import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkChangeset } from './changeset-guard.mjs';

const dir = fileURLToPath(new URL('../.changeset', import.meta.url));

describe('changeset guard', () => {
  it('the committed pending changesets are valid', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
    for (const f of files) {
      expect(checkChangeset(f, readFileSync(join(dir, f), 'utf8'))).toEqual([]);
    }
  });

  it('accepts a seekstone-only changeset, quoted or not, LF or CRLF', () => {
    expect(checkChangeset('a.md', '---\n"seekstone": minor\n---\n\nSummary.\n')).toEqual([]);
    expect(checkChangeset('a.md', "---\n'seekstone': patch\n---\n\nSummary.\n")).toEqual([]);
    expect(checkChangeset('a.md', '---\nseekstone: major\n---\n\nSummary.\n')).toEqual([]);
    expect(checkChangeset('a.md', '---\r\n"seekstone": minor\r\n---\r\n\r\nSummary.\r\n')).toEqual(
      [],
    );
  });

  it('accepts an empty (no-release) changeset', () => {
    expect(checkChangeset('a.md', '---\n---\n')).toEqual([]);
    expect(checkChangeset('a.md', '---\n---\n\nInternal only.\n')).toEqual([]);
  });

  it('fails the mixed changeset that broke the 0.17.0 release', () => {
    const errs = checkChangeset(
      '.changeset/maxsim.md',
      '---\n"seekstone": minor\n"@seekstone/core": minor\n---\n\nMaxSim rerank.\n',
    );
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/^\.changeset\/maxsim\.md: names "@seekstone\/core"/);
    expect(errs[0]).toMatch(/Remove that line/);
  });

  it('fails a changeset naming only a private package', () => {
    const errs = checkChangeset('a.md', '---\n"@seekstone/harness": patch\n---\n\nx\n');
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/"@seekstone\/harness"/);
  });

  it('fails an unknown bump type', () => {
    const errs = checkChangeset('a.md', '---\n"seekstone": huge\n---\n\nx\n');
    expect(errs).toEqual(['a.md: bump "huge" for "seekstone" must be one of patch, minor, major.']);
  });

  it('fails a file with no frontmatter or an unparseable line', () => {
    expect(checkChangeset('a.md', 'Just prose.\n')[0]).toMatch(/missing the "---" frontmatter/);
    expect(checkChangeset('a.md', '---\nnot a mapping\n---\n')[0]).toMatch(
      /cannot parse frontmatter line "not a mapping"/,
    );
  });
});
