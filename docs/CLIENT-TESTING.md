# Client testing

How Seekstone backs the claim "works with any MCP client" (positioning decision SHA-217).

## The layers

| Layer | What | When it runs |
|---|---|---|
| Protocol conformance | `npm run conformance` — boots the built server over stdio with the MCP SDK reference client; asserts the initialize handshake, the exact `HANDLED_TOOLS` surface, and a `search` + `append_note` round-trip against a scratch vault | Every CI run (Linux leg) and as a release gate |
| Config writers | Unit tests per `seekstone init --client <name>` target (`packages/server/src/init.test.ts`) — exact file format and path per client | Every `npm test` |
| Write-safety baseline | `node scripts/check-safety-baseline.mjs` — re-runs the harness safety suite and diffs against the committed golden report, gating client-visible write behavior | Every CI run (Linux leg) and as a release gate |
| Real-client E2E | `scripts/claude-code-e2e.sh` — packs the current build, attaches it to headless Claude Code via `--mcp-config`, and asserts a model-driven `search` retrieves seeded vault content | Manual, before releases that change tool schemas |
| GUI client checklist | The table below | Manual, when tool schemas or install docs change |

If protocol conformance passes, any spec-compliant stdio client can talk to Seekstone — per-client work is config plumbing, which the other layers cover.

## Manual GUI checklist

For each client, three steps against a scratch vault (never a personal one):

1. **Install** exactly as the README documents it for that client — no undocumented workarounds. If a workaround is needed, that's a docs bug; fix the docs.
2. **Tools appear** — the client's MCP/server UI lists seekstone with 19 tools.
3. **One search + one write** — ask for a term seeded in the scratch vault (search must return it), then ask to append a line to a note (file on disk must change, frontmatter untouched).
4. **Semantic mode (when testing it)** — run `npx -y seekstone fetch-model` once, set `SEEKSTONE_SEMANTIC=1` in the client's server env, restart the session, and ask a meaning-based question whose words don't appear in the target note (`search` with `mode: "semantic"` must return it; before the index finishes building, the structured `semantic_building` progress error is the correct behavior).

Record each pass here (newest first):

| Date | Client + version | Seekstone | Result | Notes |
|---|---|---|---|---|
| _(add rows as runs happen)_ | | | | |

Shipped first-class `init --client` targets: **Claude Desktop, Claude Code (scripted — see above), Cursor, VS Code / Copilot** (`init.ts` — `desktop | code | cursor | vscode`, each with one-click install paths in the README). Still uncovered: JetBrains AI Assistant (SHA-67), Windsurf (generic manual-config block only).

## Non-clients

ChatGPT cannot run local stdio MCP servers (remote Streamable HTTP only) — deferred by SHA-217, gated on SHA-209. Don't add it to the checklist until that ships.
