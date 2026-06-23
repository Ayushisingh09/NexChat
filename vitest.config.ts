import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only — no DB/Redis. External singletons are mocked per-suite.
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
