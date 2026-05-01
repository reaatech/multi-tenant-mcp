import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
});
