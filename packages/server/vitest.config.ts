import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The watcher suite drives real chokidar filesystem events; under parallel
    // load (worse under coverage instrumentation), event delivery can lag many
    // seconds. A generous per-test timeout prevents false failures (passing
    // assertions still resolve immediately).
    testTimeout: 35000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Excluded from the gate: the thin bootstrap entry (side-effecting, only
      // exercised by the smoke test), type-only modules, the fs-integration
      // watcher (validated by the cross-platform Test step, not unit coverage),
      // and test files.
      exclude: [
        'src/index.ts',
        'src/context.ts',
        'src/index/types.ts',
        'src/watcher.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 95,
        branches: 75,
      },
    },
  },
});
