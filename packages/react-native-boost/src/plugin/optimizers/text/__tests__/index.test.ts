import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { textOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(textOptimizer),
  title: 'text',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

// The expo-router cases also pin that the `asChild` bail is independent of the ancestor assumption.
const unknownAncestorAssumptionFixtures = [
  'text-under-unknown-ancestor',
  'text-with-runtime-parent',
  'expo-router-link-as-child',
  'expo-router-link-as-child-false-static',
  'expo-router-link-alias-as-child',
  'expo-router-link-namespace-as-child',
  'expo-router-link-as-child-nested-view',
];

pluginTester({
  plugin: generateTestPlugin(textOptimizer, {
    assumptions: { unknownAncestorsDoNotRenderText: true },
  }),
  title: 'text unknown ancestor assumption',
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
  tests: unknownAncestorAssumptionFixtures.map((name) => ({
    title: name,
    fixture: path.resolve(import.meta.dirname, `fixtures/${name}/code.js`),
    outputFixture: path.resolve(import.meta.dirname, `fixtures/${name}/dangerous-output.js`),
  })),
});

pluginTester({
  plugin: generateTestPlugin(textOptimizer, { integrations: { unistyles: 'on' } }),
  title: 'text unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(textOptimizer, { integrations: { unistyles: 'on' } }),
  title: 'text unistyles typescript',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles-ts'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx', ['@babel/plugin-syntax-typescript', { isTSX: true }]],
  },
  formatResult: formatTestResult,
});
