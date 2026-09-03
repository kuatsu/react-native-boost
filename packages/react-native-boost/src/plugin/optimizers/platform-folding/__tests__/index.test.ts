import { transformSync, type TransformCaller } from '@babel/core';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import type { TargetPlatform } from '../../../types';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { platformFoldingOptimizer } from '..';

function transformPlatform(source: string, platform?: TargetPlatform, filename = '/app/source.js'): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    filename,
    plugins: ['@babel/plugin-syntax-jsx', generateTestPlugin(platformFoldingOptimizer, {}, platform)],
  })!.code!;
}

function transformWithBoost(
  source: string,
  platform: TargetPlatform = 'ios',
  options: Record<string, unknown> = {}
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
          target: { reactNative: { version: '0.87.1' } },
          assumptions: { unknownAncestorsDoNotRenderText: true },
          ...options,
        },
      ],
    ],
  })!.code!;
}

describe('platform folding optimizer', () => {
  it.each(['ios', 'android'] as const)('selects the target and then native fallback on %s', (platform) => {
    const output = transformPlatform(
      `
        import { Platform as RNPlatform } from 'react-native';
        const selected = RNPlatform.select({
          default: 'default',
          native: 'native',
          ${platform}: '${platform}',
        });
        const fallback = RNPlatform.select({ default: 'default', native: 'native' });
        const defaultOnly = RNPlatform.select({ default: 'default' });
        const branch = RNPlatform.OS === '${platform}' ? 'yes' : 'no';
      `,
      platform
    );

    expect(output).toContain(`const selected = '${platform}';`);
    expect(output).toContain("const fallback = 'native';");
    expect(output).toContain("const defaultOnly = 'default';");
    expect(output).toContain("const branch = 'yes';");
    expect(output).not.toContain('RNPlatform.select');
    expect(output).not.toContain('RNPlatform.OS');
  });

  it('supports namespace imports and !== comparisons', () => {
    const output = transformPlatform(
      `
        import * as ReactNative from 'react-native';
        const component = ReactNative.Platform.OS !== 'android' ? <IOS /> : <Android />;
      `,
      'ios'
    );

    expect(output).toContain('const component = <IOS />;');
    expect(output).not.toContain('<Android');
  });

  it('keeps unsafe select specs and unsupported branches unchanged', () => {
    const output = transformPlatform(`
      import { Platform } from 'react-native';
      const computed = Platform.select({ [key]: 'computed', ios: 'ios' });
      const spread = Platform.select({ ...spec, ios: 'ios' });
      const getter = Platform.select({ get ios() { return 'getter'; } });
      const extraArgument = Platform.select({ ios: 'ios' }, sideEffect());
      const loose = Platform.OS == 'ios' ? 'yes' : 'no';
      const dynamic = Platform.OS === target ? 'yes' : 'no';
      const version = Platform.Version === 'ios' ? 'yes' : 'no';
      const constants = Platform.constants === 'ios' ? 'yes' : 'no';
    `);

    expect(output.match(/Platform\.select\(/g)).toHaveLength(4);
    expect(output).toContain("Platform.OS == 'ios'");
    expect(output).toContain('Platform.OS === target');
    expect(output).toContain("Platform.Version === 'ios'");
    expect(output).toContain("Platform.constants === 'ios'");
  });

  it('requires the Platform binding from react-native', () => {
    const output = transformPlatform(
      `
      import { Platform } from 'other-library';
      const selected = Platform.select({ ios: 'ios' });
      const branch = Platform.OS === 'ios' ? 'yes' : 'no';
    `,
      'ios'
    );

    expect(output).toContain('Platform.select({');
    expect(output).toContain("Platform.OS === 'ios'");
  });

  it('respects the optimization setting', () => {
    const output = transformWithBoost(
      `import { Platform } from 'react-native'; const value = Platform.select({ ios: 'ios' });`,
      'ios',
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
