import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tsx transpiles imports lazily — the first test in each file absorbs the
    // full module-graph startup cost. On slow Windows CI runners this can exceed
    // the 5000ms default (observed: bench/report first test at 5301ms).
    // 15s gives a comfortable buffer without masking genuinely slow tests.
    testTimeout: 15000,
  },
});
