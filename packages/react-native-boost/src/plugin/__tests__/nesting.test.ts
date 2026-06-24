import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateCombinedTestPlugin } from '../utils/generate-test-plugin';
import { formatTestResult } from '../utils/format-test-result';

// These run BOTH optimizers per element (like the real plugin), which is required to exercise nested
// optimization: an outer `View` is rewritten first, then inner elements must recognize that rewritten
// host as a safe ancestor and keep optimizing down the tree.
pluginTester({
  plugin: generateCombinedTestPlugin(),
  title: 'nesting',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-nesting'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateCombinedTestPlugin({ unistyles: true }),
  title: 'nesting unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-nesting-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
