import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Self-contained bundle for .mcpb distribution. Claude Desktop runs this with
// its built-in Node.js in an isolated directory — no node_modules available.
// Everything must be inlined; nothing can remain external.
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
  sourcemap: true,
  clean: true,
});
