import base from '../vitest.config.parity.mjs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('uniwind/package.json'));
const local = (filename: string) => fileURLToPath(new URL(filename, import.meta.url));
import { defineConfig } from 'vitest/config';
export default defineConfig({
  ...base,
  plugins: [
    {
      name: 'uniwind-parity',
      enforce: 'pre' as const,
      resolveId(source: string) {
        if (source === 'react-native-boost/uniwind') return local('../../../../runtime/uniwind.ts');
        if (source.startsWith('react-native-boost/uniwind/'))
          return join(root, 'src/components/native', source.split('/').at(-1) + '.ts');
        if (source.startsWith('@babel/runtime/'))
          return createRequire(require.resolve('react-native/package.json')).resolve(source);
      },
      transform(code: string, id: string) {
        if (!id.startsWith(root + '/') || !/\.tsx?$/.test(id)) return;
        const result = transformSync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          presets: [[require.resolve('@react-native/babel-preset'), { disableImportExportTransform: true }]],
        });
        return result?.code ? { code: result.code, map: result.map } : null;
      },
    },
    ...base.plugins!,
  ],
  resolve: { alias: [{ find: /^react-native$/, replacement: local('./react-native.ts') }] },
  test: {
    ...base.test,
    name: 'uniwind-parity',
    include: [local('./uniwind.test.tsx')],
    server: { deps: { inline: [/react-native/, /uniwind/] } },
  },
});
