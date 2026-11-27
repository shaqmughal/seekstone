import { describe, expect, it } from 'vitest';
import {
  byRoot,
  changedLines,
  changedTestFiles,
  evaluate,
  isTestSupport,
  scopeViolations,
  sourceToRevert,
  weakenedTests,
} from './quality-rules.mjs';

const mod = (filename: string, patch: string, additions = 1, deletions = 1) => ({
  filename,
  status: 'modified',
  additions,
  deletions,
  patch,
});

describe('weakened tests', () => {
  it('flags a deleted test file', () => {
    expect(weakenedTests([{ filename: 'src/a.test.ts', status: 'removed' }])).toEqual([
      'src/a.test.ts: test file deleted',
    ]);
  });

  it('flags removed test declarations', () => {
    const patch = "@@\n-  it('works', () => {\n-    expect(1).toBe(1);\n-  });\n";
    expect(weakenedTests([mod('src/a.test.ts', patch)])).toEqual([
      'src/a.test.ts: 1 test(s) removed',
    ]);
  });

  it('does not flag a test that moved within the file', () => {
    const patch = "@@\n-  it('works', () => {});\n+  it('works', () => {});\n";
    expect(weakenedTests([mod('src/a.test.ts', patch)])).toEqual([]);
  });

  it.each([
    "+  it.skip('x', () => {});",
    "+  test.only('x', () => {});",
    "+describe.skip('suite', () => {",
    "+  it.todo('later');",
    "+  xit('x', () => {});",
  ])('flags an added %s', (line) => {
    expect(weakenedTests([mod('src/a.test.ts', `@@\n${line}\n`)])).toHaveLength(1);
  });

  it('ignores skip/only text inside a string (e.g. test fixtures)', () => {
    const patch = `@@\n+    "+  it.skip('x', () => {});",\n+  const s = 'test.only(';\n`;
    expect(weakenedTests([mod('src/a.test.ts', patch)])).toEqual([]);
  });

  it('flags it.skipIf', () => {
    expect(
      weakenedTests([mod('src/a.test.ts', "@@\n+  it.skipIf(isWin)('x', () => {});\n")]),
    ).toHaveLength(1);
  });

  it('counts it.each and test.concurrent as declarations', () => {
    const patch =
      "@@\n-  it.each([1, 2])('n=%s', (n) => {});\n-  test.concurrent('c', () => {});\n";
    expect(weakenedTests([mod('src/a.test.ts', patch)])).toEqual([
      'src/a.test.ts: 2 test(s) removed',
    ]);
  });

  it('ignores non-test files and added tests', () => {
    expect(weakenedTests([mod('src/a.ts', "@@\n-  it('x', () => {});\n")])).toEqual([]);
    expect(weakenedTests([mod('src/a.test.ts', "@@\n+  it('new', () => {});\n")])).toEqual([]);
  });

  it('does not treat the diff header as a removed line', () => {
    const patch = "--- a/src/a.test.ts\n+++ b/src/a.test.ts\n@@\n+  it('new', () => {});\n";
    expect(weakenedTests([mod('src/a.test.ts', patch)])).toEqual([]);
  });
});

describe('scope lock', () => {
  it.each([
    '.github/workflows/ci.yml',
    'CLAUDE.md',
    'packages/server/CLAUDE.md',
    'AGENTS.md',
    '.claude/settings.json',
    'biome.json',
    'codecov.yml',
    '.coderabbit.yaml',
  ])('locks %s', (path) => {
    expect(scopeViolations([{ filename: path, status: 'modified' }], [])).toHaveLength(1);
  });

  it('allows ordinary source, test and doc changes', () => {
    const files = ['packages/server/src/a.ts', 'scripts/b.test.ts', 'README.md'].map(
      (filename) => ({
        filename,
        status: 'modified',
      }),
    );
    expect(scopeViolations(files, [])).toEqual([]);
  });

  it('allows a lockfile change only with the dependencies label', () => {
    const files = [{ filename: 'package-lock.json', status: 'modified' }];
    expect(scopeViolations(files, [])).toHaveLength(1);
    expect(scopeViolations(files, ['dependencies'])).toEqual([]);
  });

  describe('package.json dependency lists', () => {
    const block = (field: string, change: string) =>
      [
        '@@ -10,6 +10,7 @@',
        '   },',
        `   "${field}": {`,
        '     "a": "^1.0.0",',
        change,
        '     "c": "^3.0.0"',
        '   },',
      ].join('\n');
    const fields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const edits = {
      adds: '+    "b": "^2.0.0",',
      removes: '-    "b": "^2.0.0",',
      changes: '-    "b": "^2.0.0",\n+    "b": "^2.1.0",',
    };

    for (const field of fields) {
      it.each(Object.entries(edits))(`flags a PR that %s an entry in ${field}`, (_, change) => {
        for (const path of ['package.json', 'packages/server/package.json']) {
          expect(scopeViolations([mod(path, block(field, change))], ['factory'])).toEqual([
            `${path}: dependency change without the \`dependencies\` label`,
          ]);
        }
      });
    }

    it('flags an entry added to a block whose opening line is outside the hunk', () => {
      const patch = '@@ -40,5 +40,6 @@\n     "a": "^1.0.0",\n+    "b": "workspace:*",\n   },\n';
      expect(scopeViolations([mod('package.json', patch)], [])).toHaveLength(1);
    });

    it('flags a whole dependency block added on one line', () => {
      const patch = '@@ -1,3 +1,3 @@\n-{"name":"x"}\n+{"name":"x","dependencies":{"b":"1"}}\n';
      expect(scopeViolations([mod('package.json', patch)], [])).toHaveLength(1);
    });

    it('flags a package.json whose diff GitHub left out', () => {
      const files = [{ filename: 'package.json', status: 'modified', additions: 1, deletions: 1 }];
      expect(scopeViolations(files, [])).toHaveLength(1);
    });

    it('allows changes to scripts, version and description', () => {
      const patch = [
        '--- a/package.json',
        '+++ b/package.json',
        '@@ -1,8 +1,8 @@',
        ' {',
        '   "name": "seekstone",',
        '-  "version": "1.0.0",',
        '+  "version": "1.1.0",',
        '-  "description": "old",',
        '+  "description": "new",',
        '   "type": "module",',
        '@@ -20,6 +20,7 @@',
        '   "scripts": {',
        '     "build": "tsup",',
        '+    "bench": "node bench.mjs",',
        '-    "test": "vitest run"',
        '+    "test": "vitest run --coverage"',
        '   },',
        '   "dependencies": {',
        '     "a": "^1.0.0"',
        '@@ -50,4 +51,4 @@',
        '     "lint": "biome check .",',
        '-    "format": "biome format"',
        '+    "format": "biome format --write"',
        '   },',
      ].join('\n');
      expect(scopeViolations([mod('package.json', patch)], ['factory'])).toEqual([]);
    });

    it('allows a dependency-list change with the dependencies label', () => {
      const files = fields.map((field, i) =>
        mod(`packages/p${i}/package.json`, block(field, edits.changes)),
      );
      expect(scopeViolations(files, ['factory', 'dependencies'])).toEqual([]);
    });
  });
});

describe('size limit', () => {
  it('counts additions and deletions, skipping generated files', () => {
    const files = [
      mod('src/a.ts', '', 100, 50),
      mod('package-lock.json', '', 5000, 4000),
      mod('packages/server/CHANGELOG.md', '', 10, 0),
      mod('packages/harness/fixtures/baseline-reports/x.json', '', 900, 900),
      mod('benchmarks.json', '', 300, 300),
      mod('.changeset/x.md', '', 5, 0),
    ];
    expect(changedLines(files)).toBe(150);
  });
});

describe('evaluate', () => {
  it('passes a clean human PR', () => {
    const r = evaluate([mod('src/a.ts', '', 1000, 1000)], []);
    expect(r.ok).toBe(true);
  });

  it('fails weakened tests until the approval label is added', () => {
    const files = [{ filename: 'src/a.test.ts', status: 'removed' }];
    expect(evaluate(files, []).ok).toBe(false);
    expect(evaluate(files, []).failures[0]).toMatch(/tests-weakened:approved/);
    const approved = evaluate(files, ['tests-weakened:approved']);
    expect(approved.ok).toBe(true);
    expect(approved.weakened).toHaveLength(1);
  });

  it('applies the scope lock and size limit only to factory PRs', () => {
    const files = [mod('.github/workflows/ci.yml', '', 300, 200)];
    expect(evaluate(files, []).ok).toBe(true);
    const f = evaluate(files, ['factory']);
    expect(f.ok).toBe(false);
    expect(f.failures.join('\n')).toMatch(/Scope lock/);
    expect(f.failures.join('\n')).toMatch(/Size limit: 500 changed lines/);
  });

  it('lists changed test files, sorted, without removed ones', () => {
    const files = [
      mod('b.test.ts', ''),
      { filename: 'gone.test.ts', status: 'removed' },
      { filename: 'a.test.ts', status: 'added' },
      mod('src/x.ts', ''),
    ];
    expect(changedTestFiles(files)).toEqual(['a.test.ts', 'b.test.ts']);
    expect(evaluate(files, ['tests-weakened:approved']).testFiles).toEqual([
      'a.test.ts',
      'b.test.ts',
    ]);
  });
});

describe('byRoot', () => {
  it('refuses paths that would be read as Vitest options', () => {
    expect(() => byRoot(['--reporter=x.test.ts'])).toThrow(/refusing/);
    expect(() => byRoot(['packages/server/-x.test.ts'])).toThrow(/refusing/);
  });

  it('groups test paths by package so Vitest uses each package config', () => {
    const g = byRoot([
      'packages/server/src/a.test.ts',
      'scripts/b.test.ts',
      'packages/server/src/c.test.ts',
      'packages/harness/src/d.test.ts',
    ]);
    expect([...g.entries()]).toEqual([
      ['packages/server', ['src/a.test.ts', 'src/c.test.ts']],
      ['.', ['scripts/b.test.ts']],
      ['packages/harness', ['src/d.test.ts']],
    ]);
  });
});

describe('isTestSupport', () => {
  it('matches stubs, mocks, fakes, fixtures and test utilities', () => {
    for (const p of [
      'packages/harness/src/bench/adapters/stub-mcp-server.mjs',
      'src/mock-fs.ts',
      'src/fake-clock.js',
      'src/server.stub.ts',
      'src/__fixtures__/note.md',
      'src/__mocks__/fs.ts',
      'src/testdata/x.json',
      'src/test-utils/render.ts',
      'packages/core/src/embed/testutil.ts',
      'scripts/factory/fixtures/coderabbit-review-outside-diff.md',
      'src/fixtures/reviews/pr.json',
    ]) {
      expect(isTestSupport(p), p).toBe(true);
    }
  });

  it('leaves ordinary source alone', () => {
    for (const p of [
      'packages/harness/src/bench/adapters/mcp-subprocess.ts',
      'src/stubborn.ts',
      'src/mockingbird/index.ts',
      'src/tools/fixture_loader_service.ts',
      'packages/harness/src/fixtures/generate.ts',
      'src/fixtures/load.mjs',
      'src/fixtures.md',
      'src/stub_resolver.ts',
      'scripts/quality-rules.mjs',
    ]) {
      expect(isTestSupport(p), p).toBe(false);
    }
  });
});

describe('sourceToRevert', () => {
  it("puts a renamed file's base content at its new path", () => {
    const files = [{ filename: 'src/b.ts', status: 'renamed', previous_filename: 'src/old-b.ts' }];
    expect(sourceToRevert(files)).toEqual({
      changed: [],
      added: [],
      renamed: [{ from: 'src/old-b.ts', to: 'src/b.ts' }],
    });
  });

  it('keeps tests and test support at the PR version', () => {
    const files = [
      { filename: 'src/a.ts', status: 'modified' },
      { filename: 'src/new.ts', status: 'added' },
      { filename: 'src/b.ts', status: 'renamed', previous_filename: 'src/old-b.ts' },
      { filename: 'src/a.test.ts', status: 'modified' },
      { filename: 'src/stub-server.mjs', status: 'modified' },
      { filename: 'src/stub-new.mjs', status: 'added' },
      { filename: 'scripts/factory/fixtures/review.md', status: 'added' },
    ];
    expect(sourceToRevert(files)).toEqual({
      changed: ['src/a.ts'],
      added: ['src/new.ts'],
      renamed: [{ from: 'src/old-b.ts', to: 'src/b.ts' }],
    });
  });
});
