import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Only src — future Playwright specs must never be picked up by Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
        // Reporting only — thresholds are enforced in @nalvita/core, not the UI.
      },
    },
  }),
);
