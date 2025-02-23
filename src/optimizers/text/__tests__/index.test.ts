import path from 'node:path';
import { pluginTester } from 'babel-plugin-tester/pure';
import plugin from '../../../plugin';

pluginTester({
  plugin,
  title: 'text',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
});
