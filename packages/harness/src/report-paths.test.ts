import { describe, expect, it } from 'vitest';
import { normalizeReportPath } from './report-paths.js';

const REPO = '/Users/x/code/seekstone';
const TMP = '/var/folders/xk/abc/T';
const HOME = '/Users/x';
const opts = { cwd: REPO, tmpdir: TMP, home: HOME };

describe('normalizeReportPath', () => {
  it('renders a path inside the repo as a repo-relative POSIX path', () => {
    expect(normalizeReportPath(`${REPO}/packages/harness/fixtures/vault`, opts)).toBe(
      'packages/harness/fixtures/vault',
    );
  });

  it('renders the repo root itself as the empty-ish relative path, not absolute', () => {
    // `relative(repo, repo)` is '' which we treat as "not inside" and fall through.
    // A child one level down is the meaningful case and stays relative.
    expect(normalizeReportPath(`${REPO}/reports`, opts)).toBe('reports');
  });

  it('maps an OS-tmpdir copy to <tmpdir>/<name>', () => {
    expect(normalizeReportPath(`${TMP}/seekstone-safety-1782434474491`, opts)).toBe(
      '<tmpdir>/seekstone-safety-1782434474491',
    );
  });

  it('matches a macOS /private-prefixed tmpdir against the /var-form tmpdir', () => {
    // os.tmpdir() yields /var/...; mkdtemp yields /private/var/... — must still match.
    expect(normalizeReportPath(`/private${TMP}/seekstone-safety-99`, opts)).toBe(
      '<tmpdir>/seekstone-safety-99',
    );
  });

  it('renders the tmpdir root itself as <tmpdir>', () => {
    expect(normalizeReportPath(TMP, opts)).toBe('<tmpdir>');
  });

  it('scrubs a username from a personal path under $HOME but outside the repo', () => {
    expect(normalizeReportPath('/Users/x/Documents/My Vault', opts)).toBe(
      '<home>/Documents/My Vault',
    );
  });

  it('prefers the repo-relative form over the $HOME form when both apply', () => {
    // The repo lives under HOME; branch order must pick repo-relative.
    expect(normalizeReportPath(`${REPO}/packages`, opts)).toBe('packages');
  });

  it('leaves an unrelated absolute path unchanged', () => {
    expect(normalizeReportPath('/opt/data/vault', opts)).toBe('/opt/data/vault');
  });

  it('does not leak a username for any path under $HOME', () => {
    const out = normalizeReportPath('/Users/x/anything/here', opts);
    expect(out).not.toContain('/Users/x');
  });
});
