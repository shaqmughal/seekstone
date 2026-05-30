import { defineConfig } from 'tsup';

// Bundles the MCP server (and the @seekstone/core workspace package) into a
// single self-contained ESM file with a `#!/usr/bin/env node` shebang.
// Runtime npm dependencies stay external — they're installed from package.json.
// `@seekstone/core` is private and never published, so it MUST be bundled in.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  bundle: true,
  // Force the otherwise-default-external workspace package to be inlined.
  noExternal: [/^@seekstone\//],
  dts: false,
  sourcemap: true,
  clean: true,
});
