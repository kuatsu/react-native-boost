import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { viewOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(viewOptimizer),
  title: 'view',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
});
