import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node, not jsdom: nothing in this package touches a DOM — that is the
    // point of it. Hook-rendering tests that need one can opt in per file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/index.ts', 'src/**/*.d.ts'],
      // Reporting only — thresholds are enforced in @nalvita/core.
    },
  },
});
