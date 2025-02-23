import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // babel-plugin-tester requires it and describe to be set globally
    globals: true,
  },
});
