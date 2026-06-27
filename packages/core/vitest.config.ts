import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      // @seekstone/core holds the safety-critical shared primitives (byte-aware
      // frontmatter round-trip, link extraction, outline). Gate it like the
      // server and harness so a regression in these fails the build. Thresholds
      // sit below current coverage (96/82/100/99) with headroom.
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 95,
        branches: 75,
      },
    },
  },
});
