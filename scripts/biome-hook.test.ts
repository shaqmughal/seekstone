import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { targetFile } from './biome-hook.mjs';

const ROOT = '/repo';
const at = (file_path: unknown) => ({ tool_input: { file_path } });

describe('targetFile', () => {
  it('returns the repo-relative path for files Biome checks', () => {
    expect(targetFile(at('/repo/packages/server/src/x.ts'), ROOT)).toBe(
      join('packages', 'server', 'src', 'x.ts'),
    );
    expect(targetFile(at('scripts/a.mjs'), ROOT)).toBe(join('scripts', 'a.mjs'));
    expect(targetFile(at('/repo/biome.json'), ROOT)).toBe('biome.json');
  });

  it('skips files Biome does not handle', () => {
    expect(targetFile(at('/repo/README.md'), ROOT)).toBeNull();
    expect(targetFile(at('/repo/.github/workflows/ci.yml'), ROOT)).toBeNull();
  });

  it('skips files outside the repo', () => {
    expect(targetFile(at('/elsewhere/x.ts'), ROOT)).toBeNull();
    expect(targetFile(at('/repo/../x.ts'), ROOT)).toBeNull();
  });

  it('skips paths that would read as flags', () => {
    expect(targetFile(at('/repo/--write.ts'), ROOT)).toBeNull();
  });

  it('skips payloads without a file path', () => {
    expect(targetFile({}, ROOT)).toBeNull();
    expect(targetFile(null, ROOT)).toBeNull();
    expect(targetFile(at(42), ROOT)).toBeNull();
    expect(targetFile(at(''), ROOT)).toBeNull();
  });
});

describe('biome-hook (process)', () => {
  const HOOK = fileURLToPath(new URL('./biome-hook.mjs', import.meta.url));
  const REPO = fileURLToPath(new URL('..', import.meta.url));
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const run = (stdin: string) =>
    spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8', timeout: 30_000 });

  it('exits 0 on bad input or a file it skips', () => {
    expect(run('not json').status).toBe(0);
    expect(run(JSON.stringify(at('/elsewhere/x.ts'))).status).toBe(0);
  });

  it('formats a file in place and exits 0 when nothing is left to fix', () => {
    dir = mkdtempSync(join(REPO, 'scripts', '.biome-hook-test-'));
    const file = join(dir, 'fmt.ts');
    writeFileSync(file, 'export const a  =  "x"\n');
    const r = run(JSON.stringify(at(file)));
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe("export const a = 'x';\n");
  });

  it('exits 2 and reports problems Biome cannot fix', () => {
    dir = mkdtempSync(join(REPO, 'scripts', '.biome-hook-test-'));
    const file = join(dir, 'lint.ts');
    writeFileSync(file, 'export function f(a: any) {\n  return a == 1;\n}\n');
    const r = run(JSON.stringify(at(resolve(file))));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Biome found problems');
  });
});
