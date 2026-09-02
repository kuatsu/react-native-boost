import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import plugin from '..';
import { formatTestResult } from '../utils/format-test-result';

pluginTester({
  plugin,
  pluginOptions: { logLevel: 'silent' },
  title: 'nesting',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-nesting'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin,
  pluginOptions: { logLevel: 'silent', integrations: { unistyles: 'on' } },
  title: 'nesting unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-nesting-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
