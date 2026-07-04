import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'], // polyfill DOMParser/XMLSerializer for the engine
    include: ['tests/**/*.test.ts'],
  },
});
