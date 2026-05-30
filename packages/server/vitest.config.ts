import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The watcher suite drives real chokidar filesystem events; under parallel
    // load, event delivery can lag several seconds. A generous per-test timeout
    // prevents false failures (passing assertions still resolve immediately).
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      // Excluded from the gate: the thin bootstrap entry (side-effecting, only
      // exercised by the smoke test), type-only modules, and test files.
      exclude: ['src/index.ts', 'src/context.ts', 'src/index/types.ts', '**/*.test.ts'],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 95,
        branches: 75,
      },
    },
  },
});
