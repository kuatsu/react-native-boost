import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

const runtimeMockPath = fileURLToPath(new URL('src/runtime/__tests__/mocks/react-native.ts', import.meta.url));
const parityConfig = fileURLToPath(new URL('src/plugin/__tests__/parity/vitest.config.parity.mts', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        // Unit suite: aliases `react-native` to a lightweight mock for the whole project.
        resolve: {
          alias: {
            'react-native': resolve(runtimeMockPath),
          },
        },
        test: {
          name: 'unit',
          // babel-plugin-tester requires `it` and `describe` to be set globally
          globals: true,
          // The differential parity suite needs the REAL react-native and runs under its own config.
          exclude: [...configDefaults.exclude, '**/__tests__/parity/**'],
        },
      },
      // Parity suite: dedicated config (real RN transform + redirects + react dedup).
      parityConfig,
    ],
  },
});
