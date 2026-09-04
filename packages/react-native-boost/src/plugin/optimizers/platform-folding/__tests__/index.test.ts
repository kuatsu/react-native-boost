import { createRequire } from 'node:module';
import path from 'node:path';
import { transformSync, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { platformFoldingOptimizer } from '..';

const reactNativePackageJson = createRequire(import.meta.url).resolve('react-native/package.json');
const babelOptions = { plugins: ['@babel/plugin-syntax-jsx'] };

pluginTester({
  plugin: generateTestPlugin(platformFoldingOptimizer, {}, 'ios'),
  title: 'platform folding ios',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(platformFoldingOptimizer, {}, 'android'),
  title: 'platform folding android',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-android'),
  babelOptions,
  formatResult: formatTestResult,
});

function transformPlatform(source: string): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-syntax-jsx', generateTestPlugin(platformFoldingOptimizer, {}, 'ios')],
  })!.code!;
}

function transformWithBoost(source: string, options: Record<string, unknown> = {}): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    caller: { name: 'test', platform: 'ios' } as TransformCaller,
    plugins: [
      '@babel/plugin-syntax-jsx',
      [
        boostPlugin,
        {
          logLevel: 'silent',
          target: { reactNative: { packageJson: reactNativePackageJson } },
          assumptions: { unknownAncestorsDoNotRenderText: true },
          ...options,
        },
      ],
    ],
  })!.code!;
}

describe('platform folding semantics and integration', () => {
  it('preserves discarded value evaluations, order, duplicates, and present undefined', () => {
    const output = transformPlatform(`
      import { Platform } from 'react-native';
      const calls = [];
      const record = (name, value) => { calls.push(name); return value; };
      const selected = Platform.select({
        ios: record('first ios', 'first'),
        android: record('android', 'android'),
        ios: record('second ios', undefined),
        native: record('native', 'native'),
      });
      globalThis.result = { calls, selected };
    `);
    const executable = output.replace(/^import .*;\n/, '');
    const globalObject: { result?: { calls: string[]; selected: unknown } } = {};
    new Function('globalThis', executable)(globalObject);

    expect(globalObject.result).toEqual({
      calls: ['first ios', 'android', 'second ios', 'native'],
      selected: undefined,
    });
    expect(output).not.toContain('Platform.select');
  });

  it('respects the optimization setting', () => {
    const output = transformWithBoost(
      `import { Platform } from 'react-native'; const value = Platform.select({ ios: 'ios' });`,
      { optimizations: { 'platform-folding': 'off' } }
    );

    expect(output).toContain('Platform.select({');
  });

  it('runs before the component optimizers', () => {
    const output = transformWithBoost(`
      import { Platform, StyleSheet, Text, View } from 'react-native';
      const style = Platform.select({ ios: StyleSheet.flatten([{ opacity: 1 }]), android: { opacity: 2 } });
      const component = Platform.OS === 'ios' ? <Text>ready</Text> : <View />;
      const styled = <Text style={Platform.select({ ios: { opacity: 1 }, android: { opacity: 2 } })}>styled</Text>;
    `);

    expect(output).toContain('StyleSheet.flatten, {');
    expect(output).toContain('<_NativeText');
    expect(output).toContain('opacity: 1');
    expect(output).not.toContain('processTextStyle');
    expect(output).not.toContain('Platform.select');
    expect(output).not.toContain('Platform.OS');
  });
});
