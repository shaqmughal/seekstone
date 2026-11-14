// Decide what an `mcp-publisher publish` result means for the release (SHA-528).
//
// Registry versions are immutable. When a manual Release run re-publishes a
// version that is already listed, the registry answers 400 "cannot publish
// duplicate version: <name>@<version> already exists". The step's goal (this
// version is on the registry) is already met, so that one answer counts as
// success with a warning. Everything else stays a failure: login errors,
// validation errors, the npm-lag 404 ("version ... was not found"), network
// errors, and a duplicate for some other name or version.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {{ exitCode: number | null, output: string, name: string, version: string }} result
 * @returns {{ ok: boolean, warning?: string }}
 */
export function classifyPublishResult({ exitCode, output, name, version }) {
  if (exitCode === 0) return { ok: true };

  const duplicate = new RegExp(
    `cannot publish duplicate version: ${escape(name)}@${escape(version)} already exists`,
  );
  if (duplicate.test(output)) {
    return {
      ok: true,
      warning: `${name}@${version} is already on the MCP Registry; nothing to publish.`,
    };
  }

  return { ok: false };
}
