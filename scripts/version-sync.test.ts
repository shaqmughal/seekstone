import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stampManifestVersion, syncServerJson } from './version-sync.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const pkgVersion = JSON.parse(read('packages/server/package.json')).version as string;

// The committed manifest's shape: Biome-formatted, with manifest_version
// before version, and nested objects that have their own keys.
const MANIFEST = `{
  "manifest_version": "0.4",
  "name": "seekstone",
  "version": "0.17.2",
  "server": {
    "type": "node",
    "entry_point": "dist/index.js"
  },
  "compatibility": { "platforms": ["darwin", "linux", "win32"] }
}
`;

describe('stampManifestVersion (SHA-631)', () => {
  it('sets the top-level version and leaves everything else byte for byte', () => {
    const next = stampManifestVersion(MANIFEST, '0.27.0');
    expect(JSON.parse(next).version).toBe('0.27.0');
    expect(JSON.parse(next).manifest_version).toBe('0.4');
    expect(next).toBe(MANIFEST.replace('"version": "0.17.2"', '"version": "0.27.0"'));
  });

  it('returns the text unchanged when the version already matches', () => {
    expect(stampManifestVersion(MANIFEST, '0.17.2')).toBe(MANIFEST);
  });

  it('throws when there is no top-level version to set', () => {
    expect(() => stampManifestVersion('{ "name": "x" }\n', '1.0.0')).toThrow(/top-level version/);
  });

  it('throws when the first "version" key is not the top-level one', () => {
    const nestedFirst = '{\n  "server": { "version": "1" },\n  "name": "x"\n}\n';
    expect(() => stampManifestVersion(nestedFirst, '2.0.0')).toThrow(/top-level version/);
  });
});

describe('syncServerJson', () => {
  const SERVER = `${JSON.stringify(
    {
      name: 'io.github.x/seekstone',
      version: '0.1.0',
      packages: [{ identifier: 'seekstone', version: '0.1.0' }],
    },
    null,
    2,
  )}\n`;

  it('sets the top-level and package versions', () => {
    const next = JSON.parse(syncServerJson(SERVER, '0.27.0'));
    expect(next.version).toBe('0.27.0');
    expect(next.packages[0].version).toBe('0.27.0');
  });

  it('returns identical text when already in sync', () => {
    const synced = syncServerJson(SERVER, '0.27.0');
    expect(syncServerJson(synced, '0.27.0')).toBe(synced);
  });

  it('throws on a package this repo does not publish', () => {
    const other = SERVER.replace('"identifier": "seekstone"', '"identifier": "other"');
    expect(() => syncServerJson(other, '1.0.0')).toThrow(/unknown package identifier "other"/);
  });
});

describe('the committed files', () => {
  it('match packages/server/package.json', () => {
    expect(JSON.parse(read('server.json')).version).toBe(pkgVersion);
    expect(JSON.parse(read('packages/server/manifest.json')).version).toBe(pkgVersion);
  });

  it('pass `sync-server-json.mjs --check`', () => {
    expect(() =>
      execFileSync(process.execPath, [join(root, 'scripts/sync-server-json.mjs'), '--check'], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
