/**
 * Tiny argument handling for the `seekstone` bin. Kept pure (no process exit,
 * no IO) so it can be unit-tested. The MCP server itself takes no arguments —
 * these are just the conventional `--version` / `--help` niceties expected of a
 * CLI installed via `npx`.
 */

export type CliIntent = 'version' | 'help' | 'init' | 'init-help' | 'run';

export function parseCliIntent(argv: readonly string[]): CliIntent {
  // A subcommand, if present, is the first non-flag token. A help flag after
  // the subcommand asks for the subcommand's help, so it must be recognised
  // here — before the init run path — not swallowed by init's own arg parsing.
  if (argv[0] === 'init') {
    for (const arg of argv.slice(1)) {
      if (arg === '--help' || arg === '-h') return 'init-help';
    }
    return 'init';
  }
  for (const arg of argv) {
    if (arg === '--version' || arg === '-v') return 'version';
    if (arg === '--help' || arg === '-h') return 'help';
  }
  return 'run';
}

// Shared between the top-level help and `seekstone init --help` so the two
// can't drift apart.
const initOptionLines = `  --vault <path>       Vault to use (auto-detected from Obsidian if omitted; fallback: $SEEKSTONE_VAULT)
  --client <name>      desktop (default) | code | cursor | vscode
  --write              Patch the client config in place (backs it up first)`;

export function helpText(version: string): string {
  return `seekstone ${version} — an Obsidian MCP server (filesystem-direct, low context-tax)

Seekstone runs as a Model Context Protocol stdio server. It is normally
launched by an MCP client (Claude Desktop, Claude Code, Cursor, …), not run by hand.

Usage:
  seekstone            Start the MCP server (reads from stdin/stdout)
  seekstone init       Validate a vault and print/patch the client MCP config
  seekstone --version  Print the version and exit
  seekstone --help     Print this help and exit

"seekstone init" options:
${initOptionLines}

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

export function initHelpText(version: string): string {
  return `seekstone ${version} — seekstone init

Validate an Obsidian vault and print (or, with --write, patch) the MCP config
for the chosen client (Claude Desktop, Claude Code, Cursor, VS Code).

Usage:
  seekstone init [options]

Options:
${initOptionLines}
  --help, -h           Print this help and exit

Examples:
  seekstone init
  seekstone init --vault "/Users/you/Obsidian/My Vault" --client code --write

Docs: https://github.com/shaqmughal/seekstone`;
}
