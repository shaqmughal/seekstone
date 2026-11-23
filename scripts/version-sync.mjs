// Pure logic for scripts/sync-server-json.mjs and scripts/build-mcpb.mjs,
// split out so it can be unit tested (mirrors changeset-guard.mjs).
//
// The server package's package.json `version` is the source of truth. Two
// committed files carry a copy of it and must match:
//   server.json                    the Official MCP Registry manifest
//   packages/server/manifest.json  the MCPB manifest the .mcpb bundles ship
// Each function returns the file's text with the version applied; a caller
// compares it with the file to detect drift.

/**
 * server.json with `version` and each `packages[].version` set. Throws on a
 * package identifier this repo doesn't publish.
 */
export function syncServerJson(raw, version) {
  const manifest = JSON.parse(raw);
  manifest.version = version;
  for (const pkg of manifest.packages ?? []) {
    if (pkg.identifier !== 'seekstone') {
      throw new Error(
        `server.json lists unknown package identifier "${pkg.identifier}". seekstone is the only package this repo publishes.`,
      );
    }
    pkg.version = version;
  }
  // 2-space indent and trailing newline, as committed. biome format runs after
  // this in `version-packages`, so exact formatting here is not load-bearing.
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * manifest.json with its top-level `version` set. A surgical string replace,
 * not a re-serialize, so the committed file keeps its Biome formatting
 * (`biome check .` fails on a JSON.stringify-shaped rewrite). The first
 * `"version":` key is the top-level one; `"manifest_version"` doesn't match
 * because the quote must come right before `version`.
 */
export function stampManifestVersion(raw, version) {
  const next = raw.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`);
  if (JSON.parse(next).version !== version) {
    throw new Error(`manifest.json: could not set the top-level version to ${version}.`);
  }
  return next;
}
