import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
// `fileURLToPath` (not `URL.pathname`) so paths survive percent-encodable characters (e.g. a space
// in a parent directory becomes `%20` in `.pathname`) and the Windows drive-letter prefix.
const u = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// React Native ships its own source as Flow `.js`. We only want to transform RN's own files.
const RN_SRC = /\/node_modules\/react-native\/(Libraries|src)\/.*\.js$/;
const rnDir = dirname(require.resolve('react-native/package.json'));

// Pin React + its JSX runtimes to the single copy `react-dom` resolves, so the wrapper's hooks and
// the renderer share one React instance (pnpm/hoisting can otherwise leave two copies side by side).
const reactRequire = createRequire(require.resolve('react-dom'));
const exactRedirects: Record<string, string> = {
  'react': reactRequire.resolve('react'),
  'react/jsx-runtime': reactRequire.resolve('react/jsx-runtime'),
  'react/jsx-dev-runtime': reactRequire.resolve('react/jsx-dev-runtime'),
  'react-native-boost/runtime': u('../../../runtime/index.ts'),
};

// While the fibers collector runs (suite sets BENCH_FIBERS_OUT), swap the JSX runtimes for a counting
// wrapper so every rendered node — including ones the real RN wrappers create — is tallied. No effect
// on the normal parity test run.
if (process.env.BENCH_FIBERS_OUT) {
  const jsxCounter = u('./mocks/jsx-runtime-count.ts');
  exactRedirects['react/jsx-runtime'] = jsxCounter;
  exactRedirects['react/jsx-dev-runtime'] = jsxCounter;
  // Render the Boost output through host capturers (countable, no untranspiled runtime sources).
  exactRedirects['react-native-boost/runtime'] = u('./mocks/boost-runtime.ts');
}

// Leaf RN modules that touch native code or can't load under node. Matched by basename so both the
// `react-native/Libraries/...` import and the relative `./Foo` / `../Foo` imports are redirected.
const basenameRedirects: Array<[RegExp, string]> = [
  [/(^|[./])ViewNativeComponent$/, u('./mocks/ViewNativeComponent.ts')],
  [/(^|[./])TextNativeComponent$/, u('./mocks/TextNativeComponent.ts')],
  [/(^|[./])Platform$/, u('./mocks/Platform.ts')],
  [/(^|[./])usePressability$/, u('./mocks/usePressability.ts')],
  [/(^|[./])PressabilityDebug$/, u('./mocks/PressabilityDebug.ts')],
  [/(^|[./])ReactNativeFeatureFlags$/, u('./mocks/ReactNativeFeatureFlags.ts')],
  [/(^|[./])processColor$/, u('./mocks/processColor.ts')],
];

export default defineConfig({
  plugins: [
    {
      name: 'rn-parity',
      enforce: 'pre', // run before vite's built-in alias plugin
      resolveId(source) {
        if (exactRedirects[source]) return exactRedirects[source];
        for (const [re, target] of basenameRedirects) if (re.test(source)) return target;
        // Wrapper side: pin deep RN source to the real files (RN's exports map omits the `.js`).
        if (/^react-native\/(Libraries|src)\//.test(source)) {
          return join(rnDir, source.slice('react-native/'.length) + '.js');
        }
        return null;
      },
      transform(code, id) {
        if (!RN_SRC.test(id)) return null;
        const out = transformSync(code, {
          configFile: false,
          babelrc: false,
          filename: id,
          presets: [[require.resolve('@react-native/babel-preset'), { disableImportExportTransform: true }]],
        });
        // Keeping ESM (no CJS transform) ensures transitive imports resolve back through vite.
        return out?.code ? { code: out.code, map: out.map } : null;
      },
    },
  ],
  // Regex-exact so it only matches the BARE `react-native` specifier (the runtime index's
  // `import { StyleSheet } from 'react-native'` and the dead leftover import in generated Boost
  // code). Deep `react-native/Libraries/...` paths are handled by the pre-plugin above.
  resolve: { alias: [{ find: /^react-native$/, replacement: u('./mocks/react-native.ts') }] },
  test: {
    name: 'parity',
    globals: true,
    environment: 'node',
    setupFiles: [u('./setup.ts')],
    // fibers.collect.ts is a benchmark collector that no-ops unless BENCH_FIBERS_OUT is set.
    include: [u('./parity.test.ts'), u('./fibers.collect.ts'), u('./fuzz/fuzz.test.ts')],
    server: { deps: { inline: [/react-native/] } }, // force RN source through the transform pipeline
  },
});
