import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

const runtimeMockPath = fileURLToPath(new URL('src/runtime/__tests__/mocks/react-native.ts', import.meta.url));
const parityConfig = fileURLToPath(new URL('src/plugin/__tests__/parity/vitest.config.parity.mts', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: [{ find: /^react-native$/, replacement: resolve(runtimeMockPath) }],
        },
        test: {
          name: 'unit',
          globals: true,
          // The differential parity suite needs the REAL react-native and runs under its own config.
          exclude: [...configDefaults.exclude, '**/__tests__/parity/**'],
        },
      },
      parityConfig,
    ],
  },
});
