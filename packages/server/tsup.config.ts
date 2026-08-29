import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

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
  // tsup defaults splitting to true for ESM; a dynamic import() then emits
  // chunk-*.js files and the output stops being a single-file bundle.
  splitting: false,
  // Force the otherwise-default-external workspace package to be inlined.
  noExternal: [/^@seekstone\//],
  // Inline the package version so `seekstone --version` works in the bundle.
  define: { __SEEKSTONE_VERSION__: JSON.stringify(version) },
  dts: false,
  sourcemap: true,
  clean: true,
});
