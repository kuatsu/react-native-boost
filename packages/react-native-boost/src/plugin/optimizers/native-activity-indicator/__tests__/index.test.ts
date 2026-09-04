import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { nativeActivityIndicatorOptimizer } from '..';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';

const babelOptions = { plugins: ['@babel/plugin-syntax-jsx'] };

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer, {}, 'ios'),
  title: 'activity indicator ios',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer, {}, 'android'),
  title: 'activity indicator android',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-android'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer),
  title: 'activity indicator unknown platform',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unknown-platform'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer, {}, 'web'),
  title: 'activity indicator web',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-web'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer, { integrations: { unistyles: 'on' } }, 'ios'),
  title: 'activity indicator unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeActivityIndicatorOptimizer, {}, 'ios'),
  title: 'activity indicator unknown ancestor',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unknown-ancestor'),
  babelOptions,
  formatResult: formatTestResult,
});
