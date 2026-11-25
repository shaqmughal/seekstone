/**
 * The semantic variant's manifest: separate identity, feature hardwired on.
 * Lives outside build-mcpb.mjs so a test can import it without a build (SHA-634).
 */
export function semanticManifest(base) {
  const m = structuredClone(base);
  m.name = 'seekstone-semantic';
  m.display_name = 'Seekstone (Semantic Search)';
  m.description =
    'Obsidian MCP server — filesystem-direct vault access, low context-tax. ' +
    'This variant ships the local embedding model inside the bundle: semantic ' +
    'search works out of the box, no terminal, no downloads at runtime.';
  m.server.mcp_config.env = {
    ...m.server.mcp_config.env,
    SEEKSTONE_SEMANTIC: '1',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: ${__dirname} is an mcpb manifest placeholder Claude Desktop substitutes at install, not a JS template.
    SEEKSTONE_BUNDLED_MODEL_DIR: '${__dirname}/model',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: ${user_config.*} is an mcpb manifest placeholder Claude Desktop substitutes at launch, not a JS template.
    SEEKSTONE_SEMANTIC_WEIGHTS: '${user_config.semantic_weights}',
  };
  m.user_config = {
    ...m.user_config,
    semantic_weights: {
      type: 'string',
      title: 'Model weights',
      description:
        'int8 uses about a quarter of the memory; f32 keeps the full table. Switching re-embeds the vault once. Default: int8.',
      default: 'int8',
    },
  };
  return m;
}
