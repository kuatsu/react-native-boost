import { createRequire } from 'node:module';
import path from 'node:path';
import { transformSync, type TransformCaller } from '@babel/core';
import { pluginTester } from 'babel-plugin-tester';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { formatTestResult } from '../../../utils/format-test-result';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { animatedValueInitializationOptimizer } from '..';

const reactNativePackageJson = createRequire(import.meta.url).resolve('react-native/package.json');

pluginTester({
  plugin: generateTestPlugin(animatedValueInitializationOptimizer, {}, 'ios', 87),
  title: 'animated value initialization',
  fixtures: path.resolve(import.meta.dirname, 'fixtures'),
  formatResult: formatTestResult,
});

function transformWithOptimizer(source: string, platform: 'ios' | 'web', reactNativeMinor: number): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [generateTestPlugin(animatedValueInitializationOptimizer, {}, platform, reactNativeMinor)],
  })!.code!;
}

function transformWithBoost(source: string, enabled = true): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    caller: { name: 'test', platform: 'ios' } as TransformCaller,
    plugins: [
      [
        boostPlugin,
        {
          logLevel: 'silent',
          target: { reactNative: { packageJson: reactNativePackageJson } },
          optimizations: enabled ? undefined : { 'animated-value-initialization': 'off' },
        },
      ],
    ],
  })!.code!;
}

const source = `
  import { useRef, useState } from 'react';
  import { Animated } from 'react-native';
  const value = useRef(new Animated.Value(0)).current;
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [statePosition] = useState(new Animated.ValueXY());
`;

describe('animated value initialization integration', () => {
  it('uses only hooks available in the target React Native version', () => {
    const output = transformWithOptimizer(source, 'ios', 84);

    expect(output).toContain('_useAnimatedValue(0)');
    expect(output).toContain('useRef(new Animated.ValueXY({');
    expect(output).toContain('useState(() => new Animated.ValueXY())');
  });

  it('does not change web builds', () => {
    const output = transformWithOptimizer(source, 'web', 87);

    expect(output).toContain('useRef(new Animated.Value(0)).current');
    expect(output).toContain('useState(new Animated.ValueXY())');
  });

  it('runs by default and respects its optimization setting', () => {
    expect(transformWithBoost(source)).toContain('_useAnimatedValue(0)');

    const disabledOutput = transformWithBoost(source, false);
    expect(disabledOutput).toContain('useRef(new Animated.Value(0)).current');
    expect(disabledOutput).toContain('useState(new Animated.ValueXY())');
  });
});
