import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Self-contained bundle for .mcpb distribution. Claude Desktop runs this with
// its built-in Node.js in an isolated directory — no node_modules available.
// Everything must be inlined; nothing can remain external.
//
// scripts/build-mcpb.mjs then shards this single file into <95KB pieces, because
// Claude Desktop's install preview silently rejects any bundle file >~108KB
// (SHA-169). Sourcemaps are off: the .map would be a multi-MB file we'd only
// have to drop anyway, and it ships no value to end users.
//
// Banner trick: yaml's node build is CJS and calls require('process'). tsup's
// ESM __require shim checks `typeof require !== "undefined"` at init time.
// Injecting `var require = createRequire(...)` in the banner runs BEFORE that
// check, so __require wires itself to the real Node.js require — which handles
// built-ins — instead of the throwing stub.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  bundle: true,
  noExternal: [/.*/],
  banner: {
    js: `import { createRequire } from 'module'; var require = createRequire(import.meta.url);`,
  },
  define: { __SEEKSTONE_VERSION__: JSON.stringify(version) },
  dts: false,
  sourcemap: false,
  clean: true,
});
