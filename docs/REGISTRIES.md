# Publishing to MCP registries

How Seekstone gets listed where people discover MCP servers. The repo contains
the config files each registry reads (`server.json`, `glama.json`) and the
`mcpName` field in `packages/server/package.json`.

## Two npm packages, one server

| Package | npm | Purpose |
|---|---|---|
| `obsidian-mcp-seekstone` | [link](https://www.npmjs.com/package/obsidian-mcp-seekstone) | Discoverable via "obsidian mcp" search |
| `seekstone` | [link](https://www.npmjs.com/package/seekstone) | Canonical short name |

Both are published automatically by the release pipeline on every version bump.

## Canonical copy (reuse everywhere)

- **Name:** Seekstone (also: obsidian-mcp-seekstone)
- **Tagline:** An Obsidian MCP server — filesystem-direct, low context-tax.
- **Description:** Seekstone reads your Obsidian vault directly from disk instead of routing through the Local REST API plugin, so Claude can search and edit notes without burning its context window on a single tool call (~575× smaller payloads in benchmarks). 8 tools over stdio; no Obsidian app or plugin required; macOS/Linux/Windows; no network, no telemetry.
- **Install:** `npx -y obsidian-mcp-seekstone` (also: `npx -y seekstone`); env `SEEKSTONE_VAULT=/path/to/vault`
- **Repo:** https://github.com/shaqmughal/seekstone
- **npm:** https://www.npmjs.com/package/obsidian-mcp-seekstone / https://www.npmjs.com/package/seekstone
- **Tools:** search, read_note, list_notes, create_note, delete_note, move_note, append_note, patch_frontmatter
- **Categories/tags:** obsidian, notes, knowledge-base, markdown, search, obsidian-mcp

<!-- Note: the official registry caps server.json `description` at 100 characters. -->

## 1. Official MCP registry

`server.json` lists both npm packages. After each release, re-publish to update the version:

```bash
# Install the publisher CLI (macOS/Linux):
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
# (or: brew install mcp-publisher)

mcp-publisher login github   # device-code auth (one-time per session)
mcp-publisher publish        # reads server.json, validates against mcpName in published package
```

Verify:
```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.shaqmughal/seekstone"
```

The registry is in **preview** — if the CLI reports a schema mismatch, re-check the `$schema` date in `server.json`.

## 2. Smithery — not pursued

Smithery's current platform is oriented toward hosted/remote servers with Streamable HTTP transport. The only path for a stdio/npm server is an MCPB bundle, which is undocumented with no available tooling on their end. The old `smithery.yaml` GitHub-connect flow is no longer supported. **Permanently excluded.**

## 3. Glama

Glama auto-indexes public repos. Direct listing: https://glama.ai/mcp/servers/@shaqmughal/seekstone

`glama.json` (repo root) sets the maintainer for claiming.

1. Sign in at https://glama.ai with GitHub.
2. Claim the `shaqmughal/seekstone` listing.

## 4. awesome-mcp-servers

PR open: https://github.com/punkpeye/awesome-mcp-servers/pull/7190

Entry uses `obsidian-mcp-seekstone` for discoverability. Update the PR if the entry needs refreshing.

## Keeping listings current

- **Official registry:** bump the version in `server.json` and re-run `mcp-publisher publish` after each release. The `version` field should always match the current `seekstone` npm version.
- **Glama:** tracks the repo automatically — no action needed on release.
- **awesome-mcp-servers:** static PR; only needs updating if the description or install command changes.
