import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { viewOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(viewOptimizer),
  title: 'view',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(viewOptimizer, {
    dangerouslyOptimizeViewWithUnknownAncestors: true,
  }),
  title: 'view dangerous unknown ancestors',
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
  tests: [
    {
      title: 'optimizes View inside unresolved ancestor when enabled',
      fixture: path.resolve(import.meta.dirname, 'fixtures/unknown-imported-ancestor/code.js'),
      outputFixture: path.resolve(import.meta.dirname, 'fixtures/unknown-imported-ancestor/dangerous-output.js'),
    },
  ],
});

// With HStack registered as a 'view' transparent wrapper, the View under it optimizes; the View under
// Body (a 'text' wrapper) and the one under the unregistered Card keep bailing. The default fixtures
// run above pins the negative: without the registry, all three bail as 'unknown'.
pluginTester({
  plugin: generateTestPlugin(viewOptimizer, {
    transparentWrappers: [
      {
        module: '@beedeez/front-common-design-system',
        components: { HStack: 'view', VStack: 'view', Body: 'text' },
      },
    ],
  }),
  title: 'view transparent wrappers',
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
  tests: [
    {
      title: 'optimizes View under a registered view wrapper only',
      fixture: path.resolve(import.meta.dirname, 'fixtures/transparent-ds-ancestor/code.js'),
      outputFixture: path.resolve(import.meta.dirname, 'fixtures/transparent-ds-ancestor/transparent-output.js'),
    },
  ],
});

pluginTester({
  plugin: generateTestPlugin(viewOptimizer, { unistyles: true }),
  title: 'view unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
