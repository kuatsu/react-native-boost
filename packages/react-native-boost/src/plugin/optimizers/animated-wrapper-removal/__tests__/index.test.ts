import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { transformSync, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { afterAll, describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { formatTestResult } from '../../../utils/format-test-result';
import { animatedWrapperRemovalOptimizer } from '..';

const babelOptions = { plugins: ['@babel/plugin-syntax-jsx'] };

pluginTester({
  plugin: generateTestPlugin(animatedWrapperRemovalOptimizer, {}, 'ios'),
  title: 'animated wrapper removal',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  babelOptions,
  formatResult: formatTestResult,
});

pluginTester({
  plugin: generateTestPlugin(animatedWrapperRemovalOptimizer, {}, 'web'),
  title: 'animated wrapper removal web',
  fixtures: path.resolve(import.meta.dirname, 'fixtures-web'),
  babelOptions,
  formatResult: formatTestResult,
});

const targetDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-boost-animated-'));
afterAll(() => fs.rmSync(targetDirectory, { recursive: true, force: true }));

function targetPackageJson(minor: number): string {
  const packageJson = path.join(targetDirectory, `${minor}.json`);
  fs.writeFileSync(packageJson, JSON.stringify({ name: 'react-native', version: `0.${minor}.0` }));
  return packageJson;
}

function transformWithBoost(
  source: string,
  reactNativeMinor = 86,
  animatedWrapperRemoval?: 'on' | 'off',
  platform = 'ios'
): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    caller: { name: 'test', platform } as TransformCaller,
    plugins: [
      '@babel/plugin-syntax-jsx',
      [
        boostPlugin,
        {
          logLevel: 'silent',
          target: { reactNative: { packageJson: targetPackageJson(reactNativeMinor) } },
          assumptions: { unknownAncestorsDoNotRenderText: true },
          optimizations: animatedWrapperRemoval ? { 'animated-wrapper-removal': animatedWrapperRemoval } : undefined,
        },
      ],
    ],
  })!.code!;
}

const source = (element: string) => `import { Animated } from 'react-native';\n${element};`;

describe('animated wrapper removal integration', () => {
  it('feeds lowered components into the native host optimizers', () => {
    const output = transformWithBoost(`
      import { Animated, View } from 'react-native';
      function Case() {
        return (
          <View>
            <Animated.View style={{ width: 12 }}>
              <Animated.Text>Ready</Animated.Text>
              <Animated.Image source={{ uri: 'logo.png' }} />
            </Animated.View>
          </View>
        );
      }
    `);

    expect(output).toContain('<_NativeView');
    expect(output).toContain('<_NativeText');
    expect(output).toContain('<_NativeImage');
    expect(output).not.toContain('<Animated.');
  });

  it('keeps the Text context visible after lowering an outer Animated.Text', () => {
    const output = transformWithBoost(`
      import { Animated, Text, View } from 'react-native';
      function Case() {
        return <View><Animated.Text><Text>nested</Text></Animated.Text></View>;
      }
    `);

    expect(output).not.toContain('NativeText');
    expect(output).not.toContain('NativeVirtualText');
    expect(output).toContain('<_AnimatedWrapperRemovalText collapsable={false} style={undefined}>');
    expect(output).toContain('<Text>nested</Text>');
  });

  it.each(['ios', 'android'])('keeps injected props safe despite the text-context assumption on %s', (platform) => {
    const output = transformWithBoost(
      `import { cloneElement } from 'react';
      import { Animated, View } from 'react-native';
      import Parent from './parent';
      function FadeIn({ children }) { return cloneElement(children, { style: { opacity } }); }
      export function Case() {
        return <View>
          <FadeIn><Animated.View /></FadeIn>
          <Parent asChild><Animated.Text>label</Animated.Text></Parent>
          <Parent render={<Animated.Image source={{ uri: 'logo.png' }} />} />
          <Parent render={() => <Animated.ScrollView />} />
          {cloneElement(<Animated.View />, { style: { opacity } })}
        </View>;
      }`,
      86,
      undefined,
      platform
    );

    for (const component of ['View', 'Text', 'Image', 'ScrollView']) {
      expect(output).toContain(`<Animated.${component}`);
    }
    expect(output).not.toContain('AnimatedWrapperRemoval');
  });

  it('defaults on only for RN 0.83 through 0.86 and honors overrides', () => {
    const input = source('<Animated.View />');
    const forcedInput = source('<>{/* @boost-force */}<Animated.View /></>');

    expect(transformWithBoost(input, 82)).toContain('<Animated.View');
    expect(transformWithBoost(input, 83)).not.toContain('<Animated.View');
    expect(transformWithBoost(input, 86)).not.toContain('<Animated.View');
    expect(transformWithBoost(input, 87)).toContain('<Animated.View');
    expect(transformWithBoost(forcedInput, 87)).toContain('<Animated.View');
    expect(transformWithBoost(input, 87, 'on')).not.toContain('<Animated.View');
    expect(transformWithBoost(input, 86, 'off')).toContain('<Animated.View');
    expect(transformWithBoost(forcedInput, 86, 'off')).toContain('<Animated.View');
  });
});
