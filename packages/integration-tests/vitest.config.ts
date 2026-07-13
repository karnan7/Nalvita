import { defineConfig } from 'vitest/config';

// The suite talks to one shared local Postgres, so files run sequentially to
// keep their fixtures independent. Each file creates (and deletes) its own
// auth users; deletes cascade to the user's rows.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: './src/setup/global-setup.ts',
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});
