import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { nativeViewOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(nativeViewOptimizer),
  title: 'view',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeViewOptimizer, {
    assumptions: { unknownAncestorsDoNotRenderText: true },
  }),
  title: 'view unknown ancestor assumption',
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
    {
      title: 'still preserves known Text context when the assumption is enabled',
      fixture: path.resolve(import.meta.dirname, 'fixtures/text-ancestor/code.js'),
      outputFixture: path.resolve(import.meta.dirname, 'fixtures/text-ancestor/output.js'),
    },
  ],
});

pluginTester({
  plugin: generateTestPlugin(nativeViewOptimizer, { integrations: { unistyles: 'on' } }),
  title: 'view unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
