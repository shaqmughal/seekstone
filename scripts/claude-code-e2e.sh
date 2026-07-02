#!/usr/bin/env bash
# Real-client E2E: install the locally built seekstone into Claude Code and
# confirm an actual model-driven `search` tool call round-trips.
#
# This is the one GUI-grade MCP client with a scriptable headless mode, so it
# stands in for the whole client class. It is a MANUAL / release-gate script,
# not CI: it needs the `claude` CLI installed and authenticated, and each run
# spends a small number of tokens.
#
# Usage: scripts/claude-code-e2e.sh
# Exits 0 iff the model reported the seeded search hit back.

set -euo pipefail

command -v claude >/dev/null || { echo "✗ claude CLI not found — install Claude Code first."; exit 1; }

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/seekstone-cc-e2e.XXXXXX")"
vault="$workdir/vault"

trap 'rm -rf "$workdir"' EXIT

# 1. Pack the current build so we test exactly what would ship, and install it
#    into a throwaway project (pre-installed → no npx cold-start racing the
#    client's MCP startup timeout).
echo "• building + packing seekstone…"
(cd "$repo_root" && npm run build -w seekstone >/dev/null)
tgz_name="$(cd "$repo_root" && npm pack -w seekstone --ignore-scripts --pack-destination "$workdir" 2>/dev/null | tail -1)"
echo "• installing $tgz_name into a scratch project…"
(cd "$workdir" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund "$workdir/$tgz_name" >/dev/null 2>&1)
server_entry="$workdir/node_modules/seekstone/dist/index.js"
[ -f "$server_entry" ] || { echo "✗ installed entry not found: $server_entry"; exit 1; }

# 2. Seed a vault with a fact the model can only know via the search tool.
mkdir -p "$vault/.obsidian" "$vault/Notes"
cat > "$vault/Notes/Passphrase.md" <<'EOF'
---
title: Passphrase
---
# Passphrase

The survey passphrase is cobalt-heron-42.
EOF

# 3. Explicit MCP config for the headless run — the documented way to attach
#    servers to `claude -p`. --strict-mcp-config keeps the user's own servers
#    out of the session; --allowedTools pre-approves the search tool so the
#    non-interactive run can't stall on a permission prompt.
cat > "$workdir/mcp-config.json" <<EOF
{
  "mcpServers": {
    "seekstone-e2e": {
      "command": "$(command -v node)",
      "args": ["$server_entry"],
      "env": { "SEEKSTONE_VAULT": "$vault" }
    }
  }
}
EOF

echo "• running headless Claude Code query…"
prompt="Using the seekstone-e2e MCP server's search tool, find the survey passphrase in my vault and reply with exactly the passphrase string."
out="$(cd "$workdir" && printf '%s' "$prompt" | claude -p \
  --mcp-config "$workdir/mcp-config.json" \
  --strict-mcp-config \
  --allowedTools "mcp__seekstone-e2e__search" 2>&1 || true)"

if grep -q "cobalt-heron-42" <<<"$out"; then
  echo "✓ Claude Code E2E passed — model retrieved the seeded passphrase via the search tool."
else
  echo "✗ Claude Code E2E failed — passphrase not found in output:"
  printf '%s\n' "$out" | tail -20
  exit 1
fi
