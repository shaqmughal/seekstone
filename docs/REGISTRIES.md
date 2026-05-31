# Publishing to MCP registries

How Seekstone gets listed where people discover MCP servers. The repo already
contains the config files each registry reads (`server.json`, `smithery.yaml`,
`glama.json`) and the `mcp-name` field in `packages/server/package.json`. What
remains are the authenticated submission steps a maintainer runs by hand.

## Canonical copy (reuse everywhere)

- **Name:** Seekstone
- **Tagline:** An Obsidian MCP server — filesystem-direct, low context-tax.
- **Description:** Seekstone reads your Obsidian vault directly from disk instead of routing through the Local REST API plugin, so Claude can search and edit notes without burning its context window on a single tool call (~575× smaller payloads in benchmarks). 8 tools over stdio; no Obsidian app or plugin required; macOS/Linux/Windows; no network, no telemetry.
- **Install:** `npx -y seekstone` (env `SEEKSTONE_VAULT=/path/to/vault`)
- **Repo:** https://github.com/shaqmughal/seekstone
- **npm:** https://www.npmjs.com/package/seekstone
- **Tools:** search, read_note, list_notes, create_note, delete_note, move_note, append_note, patch_frontmatter
- **Categories/tags:** obsidian, notes, knowledge-base, markdown, search

## 1. Official MCP registry  (requires the 0.2.1 release to be live first)

Prereq: `seekstone@0.2.1` published (it carries the `mcp-name` field the
registry validates). `server.json` at the repo root is ready.

```bash
# Install the publisher CLI (see modelcontextprotocol/registry releases for the latest)
# then, from the repo root:
mcp-publisher login github     # authorizes the io.github.shaqmughal/* namespace
mcp-publisher publish          # validates server.json + the mcp-name linkage, then lists it
```

Verify: the server resolves in the registry under `io.github.shaqmughal/seekstone`.
If the CLI reports a schema mismatch, re-check the `$schema` date in `server.json`
against the current registry docs and bump it. The registry verifies ownership by
matching the `name` here to the `mcp-name` field in the published `package.json`
(both are `io.github.shaqmughal/seekstone`), so 0.2.1 must be live on npm first.

## 2. Smithery

`smithery.yaml` (repo root) tells Smithery how to launch the stdio server.

1. Sign in at https://smithery.ai with GitHub.
2. Add/claim the server by connecting the `shaqmughal/seekstone` repo.
3. Confirm the config field (vault path) renders and a test launch works.

## 3. Glama

Glama auto-indexes public MCP repos, so Seekstone may already appear. `glama.json`
(repo root) sets the maintainer for claiming.

1. Sign in at https://glama.ai with GitHub.
2. Claim the `shaqmughal/seekstone` listing; confirm the README/metadata look right.

## 4. awesome-mcp-servers (community lists)

Open a PR adding Seekstone under the Obsidian / knowledge-management section of
the relevant list(s) (e.g. punkpeye/awesome-mcp-servers). Suggested entry:

```markdown
- [shaqmughal/seekstone](https://github.com/shaqmughal/seekstone) 📇 🏠 — Filesystem-direct Obsidian vault server with low context-tax (search + edit notes without the Local REST API plugin).
```

(Match each list's emoji/format conventions in its README before submitting.)

## Keeping listings current

On each release, bump the `version` in `server.json` and re-run `mcp-publisher publish`.
Smithery/Glama track the repo automatically. Keep the canonical copy above in sync
with the README.
