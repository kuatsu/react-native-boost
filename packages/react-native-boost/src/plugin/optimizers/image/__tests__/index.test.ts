import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { imageOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(imageOptimizer),
  title: 'image',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});
