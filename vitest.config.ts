import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup/dom.ts'],
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
  },
});
