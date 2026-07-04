# Publishing to MCP registries

How Seekstone gets listed where people discover MCP servers. The repo contains
the config files each registry reads (`server.json`, `glama.json`) and the
`mcpName` field in `packages/server/package.json`.

## One npm package

Seekstone is published as [`seekstone`](https://www.npmjs.com/package/seekstone) — the canonical and only maintained name. [`obsidian-mcp-seekstone`](https://www.npmjs.com/package/obsidian-mcp-seekstone) was a discoverability alias; it is **deprecated** (existing installs keep working, but it no longer receives updates). Discoverability for "obsidian mcp" searches now rests on the `keywords` field and description, not the package name.

## Canonical copy (reuse everywhere)

- **Name:** Seekstone
- **Tagline:** An Obsidian MCP server — filesystem-direct, low context-tax.
- **Description:** Seekstone reads your Obsidian vault directly from disk instead of routing through the Local REST API plugin, so Claude can search and edit notes without burning its context window on a single tool call (~575× smaller payloads in benchmarks). 17 tools over stdio; no Obsidian app or plugin required; macOS/Linux/Windows; no network, no telemetry.
- **Install:** `npx -y seekstone`; env `SEEKSTONE_VAULT=/path/to/vault`
- **Repo:** https://github.com/shaqmughal/seekstone
- **npm:** https://www.npmjs.com/package/seekstone
- **Tools (17):** _Read_ — search, query_notes, read_note, list_notes, list_tags, outline_note, get_backlinks, get_links, get_periodic_note · _Write_ — create_note, delete_note, move_note, append_note, patch_frontmatter, patch_note, replace_in_note, append_periodic_note
- **Categories/tags:** obsidian, notes, knowledge-base, markdown, search, obsidian-mcp

<!-- Note: the official registry caps server.json `description` at 100 characters. -->

## 1. Official MCP registry

`server.json` lists the `seekstone` npm package. After each release, re-publish to update the version:

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

The entry originally used `obsidian-mcp-seekstone`; that name is now deprecated — update the PR so the entry points at `seekstone`.

## Keeping listings current

- **Official registry:** bump the version in `server.json` and re-run `mcp-publisher publish` after each release. The `version` field should always match the current `seekstone` npm version.
- **Glama:** tracks the repo automatically — no action needed on release.
- **awesome-mcp-servers:** static PR; only needs updating if the description or install command changes.
