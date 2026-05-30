import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The watcher suite drives real chokidar filesystem events; under parallel
    // load, event delivery can lag several seconds. A generous per-test timeout
    // prevents false failures (passing assertions still resolve immediately).
    testTimeout: 20000,
  },
});
