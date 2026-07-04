import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // no DOMParser here, so xml.ts uses @xmldom/xmldom
    include: ['tests/**/*.test.ts'],
  },
});
