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

// Fixtures whose `'unknown'` ancestor bail is lifted by the dangerous flag. The expo-router cases also
// pin that the `asChild` bail is independent of the flag: a Text directly inside `<Link asChild>` still
// bails (it would be made pressable), while a Text under a plain `<Link>` optimizes.
const dangerousUnknownAncestorFixtures = [
  'text-under-unknown-ancestor',
  'expo-router-link-as-child',
  'expo-router-link-as-child-false-static',
  'expo-router-link-alias-as-child',
  'expo-router-link-namespace-as-child',
  'expo-router-link-as-child-nested-view',
];

pluginTester({
  plugin: generateTestPlugin(textOptimizer, {
    dangerouslyOptimizeTextWithUnknownAncestors: true,
  }),
  title: 'text dangerous unknown ancestors',
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
  tests: dangerousUnknownAncestorFixtures.map((name) => ({
    title: name,
    fixture: path.resolve(import.meta.dirname, `fixtures/${name}/code.js`),
    outputFixture: path.resolve(import.meta.dirname, `fixtures/${name}/dangerous-output.js`),
  })),
});

pluginTester({
  plugin: generateTestPlugin(textOptimizer, { unistyles: true }),
  title: 'text unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
