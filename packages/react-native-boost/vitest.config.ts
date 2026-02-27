import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const runtimeMockPath = fileURLToPath(new URL('src/runtime/__tests__/mocks/react-native.ts', import.meta.url));

export default defineConfig({
  test: {
    // babel-plugin-tester requires it and describe to be set globally
    globals: true,
  },
  resolve: {
    alias: {
      'react-native': resolve(runtimeMockPath),
    },
  },
});
