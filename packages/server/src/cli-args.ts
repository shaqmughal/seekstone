/**
 * Tiny argument handling for the `seekstone` bin. Kept pure (no process exit,
 * no IO) so it can be unit-tested. The MCP server itself takes no arguments —
 * these are just the conventional `--version` / `--help` niceties expected of a
 * CLI installed via `npx`.
 */

export type CliIntent = 'version' | 'help' | 'init' | 'run';

export function parseCliIntent(argv: readonly string[]): CliIntent {
  // A subcommand, if present, is the first non-flag token.
  if (argv[0] === 'init') return 'init';
  for (const arg of argv) {
    if (arg === '--version' || arg === '-v') return 'version';
    if (arg === '--help' || arg === '-h') return 'help';
  }
  return 'run';
}

export function helpText(version: string): string {
  return `seekstone ${version} — an Obsidian MCP server (filesystem-direct, low context-tax)

Seekstone runs as a Model Context Protocol stdio server. It is normally
launched by an MCP client (Claude Desktop, Claude Code), not run by hand.

Usage:
  seekstone            Start the MCP server (reads from stdin/stdout)
  seekstone init       Validate a vault and print/patch the Claude config
  seekstone --version  Print the version and exit
  seekstone --help     Print this help and exit

"seekstone init" options:
  --vault <path>       Vault to use (auto-detected from Obsidian if omitted; fallback: $SEEKSTONE_VAULT)
  --client <name>      desktop (default) | code
  --write              Patch the Claude Desktop config in place (backs it up first)

Required environment:
  SEEKSTONE_VAULT      Absolute path to your Obsidian vault

Optional environment:
  SEEKSTONE_LOG_LEVEL  error | warn | info (default) | debug
  SEEKSTONE_LOG_FILE   Absolute path; append JSON-line logs here
  SEEKSTONE_WATCH_POLL Set to 1 to poll for changes (network drives, WSL)

Add to Claude Code:
  claude mcp add seekstone --env SEEKSTONE_VAULT=/path/to/vault -- npx -y seekstone

Docs: https://github.com/shaqmughal/seekstone`;
}
