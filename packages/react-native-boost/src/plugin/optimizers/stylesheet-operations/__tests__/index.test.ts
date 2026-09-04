import { createRequire } from 'node:module';
import path from 'node:path';
import { transformSync, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { stylesheetOperationsOptimizer } from '..';

const reactNativePackageJson = createRequire(import.meta.url).resolve('react-native/package.json');

pluginTester({
  plugin: generateTestPlugin(stylesheetOperationsOptimizer, {}, 'ios'),
  title: 'stylesheet operations',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  formatResult: formatTestResult,
});

function transformWithBoost(
  source: string,
  options: Record<string, unknown> = {},
  filename = '/app/source.js'
): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    filename,
    caller: { name: 'test', platform: 'ios' } as TransformCaller,
    plugins: [
      [
        boostPlugin,
        {
          logLevel: 'silent',
          target: { reactNative: { packageJson: reactNativePackageJson } },
          ...options,
        },
      ],
    ],
  })!.code!;
}

describe('stylesheet operations integration', () => {
  it('runs through the general plugin visitor and respects configuration and file ignores', () => {
    const source = `import { StyleSheet } from 'react-native';\nconst style = StyleSheet.flatten([{ opacity: 1 }]);`;

    expect(transformWithBoost(source)).toContain('StyleSheet.flatten, {');
    expect(transformWithBoost(source, { optimizations: { 'stylesheet-operations': 'off' } })).toContain(
      'StyleSheet.flatten([{'
    );
    expect(transformWithBoost(source, { ignores: ['/app/ignored.js'] }, '/app/ignored.js')).toContain(
      'StyleSheet.flatten([{'
    );
  });
});
