import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['**/tests/firestore.rules.test.mjs', '**/node_modules/**'],
  },
});

