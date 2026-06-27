import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tsx transpiles imports lazily — the first test in each file absorbs the
    // full module-graph startup cost. On slow Windows CI runners this can exceed
    // the 5000ms default (observed: bench/report first test at 5301ms).
    // 15s gives a comfortable buffer without masking genuinely slow tests.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      // Excluded from the gate: adapters that drive an external process or HTTP
      // server (validated by running the real harness, not unit coverage), the
      // CLI wiring, the network corpus fetcher, the large fixture generator, and
      // test files. Everything else — the measurement core (profiler, safety,
      // bench report/runner/compare), the in-process fs/seekstone adapters, and
      // the deterministic fixture primitives (prng, tags) — is gated.
      exclude: [
        'src/cli.ts',
        'src/bench/adapters/rest.ts',
        'src/bench/adapters/mcpvault.ts',
        'src/bench/adapters/mcp-obsidian.ts',
        'src/bench/adapters/mcp-subprocess.ts',
        'src/bench/adapters/obsidian-mcp.ts',
        'src/bench/adapters/obsidian-mcp-pro.ts',
        'src/bench/adapters/obsidian-mcp-server.ts',
        'src/fixtures/corpus.ts',
        'src/fixtures/generate.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        statements: 88,
        lines: 88,
        functions: 88,
        branches: 70,
      },
    },
  },
});
