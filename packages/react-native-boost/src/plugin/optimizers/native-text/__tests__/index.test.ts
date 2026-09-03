import path from 'node:path';
import { transformSync, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import boostPlugin from '../../../index';
import { nativeTextOptimizer } from '..';

pluginTester({
  plugin: generateTestPlugin(nativeTextOptimizer),
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
  plugin: generateTestPlugin(nativeTextOptimizer, {
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
  plugin: generateTestPlugin(nativeTextOptimizer, { integrations: { unistyles: 'on' } }),
  title: 'text unistyles',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
  },
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(nativeTextOptimizer, { integrations: { unistyles: 'on' } }),
  title: 'text unistyles typescript',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-unistyles-ts'),
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx', ['@babel/plugin-syntax-typescript', { isTSX: true }]],
  },
  formatResult: formatTestResult,
});

const transformText = async (reactNativeMinor: number, platform?: 'ios'): Promise<string> =>
  formatTestResult(
    transformSync(
      `
        import { Text } from 'react-native';
        <Text>plain</Text>;
        <Text style={{ color: 'red' }}>static</Text>;
        <Text style={dynamicStyle}>dynamic</Text>;
      `,
      {
        configFile: false,
        babelrc: false,
        caller: { name: 'test', platform } as TransformCaller,
        plugins: [
          '@babel/plugin-syntax-jsx',
          [boostPlugin, { logLevel: 'silent', target: { reactNative: { version: `0.${reactNativeMinor}.0` } } }],
        ],
      }
    )!.code!
  );

describe('text version defaults', () => {
  it('omits the default overflow style before RN 0.85', async () => {
    const output = await transformText(84, 'ios');

    expect(output).not.toContain('getDefaultTextStyle');
    expect(output).not.toContain('textDefaultOverflowStyle');
    expect(output).not.toContain("overflow: 'hidden'");
    expect(output).toContain('processTextStyle(dynamicStyle, false)');
  });

  it('uses the default overflow style from RN 0.85', async () => {
    const output = await transformText(85, 'ios');

    expect(output).not.toContain('getDefaultTextStyle');
    expect(output).toContain('textDefaultOverflowStyle as _textDefaultOverflowStyle');
    expect(output).toContain('style={_textDefaultOverflowStyle}');
    expect(output).toContain('processTextStyle(dynamicStyle, true)');
  });

  it('keeps the runtime fallback when the platform is unknown', async () => {
    const output = await transformText(85);

    expect(output).toContain('getDefaultTextStyle');
    expect(output).not.toContain('textDefaultOverflowStyle');
    expect(output).toContain('processTextStyle(dynamicStyle)');
  });
});
