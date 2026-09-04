import { createRequire } from 'node:module';
import { transformSync, type TransformCaller } from '@babel/core';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import type { TargetPlatform } from '../../../types';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { platformFoldingOptimizer } from '..';

const reactNativePackageJson = createRequire(import.meta.url).resolve('react-native/package.json');

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
          target: { reactNative: { packageJson: reactNativePackageJson } },
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

  it('replaces read-only values and strict comparisons', () => {
    const output = transformPlatform(
      `
        import { Platform } from 'react-native';
        const platform = Platform.OS;
        const cacheKey = \`${'${Platform.OS}'}-cache\`;
        const isIOS = 'ios' === Platform.OS;
        const isAndroid = Platform.OS !== 'ios';
      `,
      'ios'
    );

    expect(output).toMatch(/const platform = ["']ios["'];/);
    expect(output).toMatch(/const cacheKey = `\$\{["']ios["']}-cache`;/);
    expect(output).toContain('const isIOS = true;');
    expect(output).toContain('const isAndroid = false;');
    expect(output).not.toContain('Platform.OS');
  });

  it('removes unreachable if branches before dependency collection', () => {
    const output = transformPlatform(
      `
        import { Platform } from 'react-native';
        if (Platform.OS === 'ios') {
          require('./install-ios');
        } else {
          require('./install-android');
        }
        if (Platform.OS !== 'ios') require('./not-ios');
      `,
      'ios'
    );

    expect(output).toContain("require('./install-ios')");
    expect(output).not.toContain('install-android');
    expect(output).not.toContain('not-ios');
    expect(output).not.toContain('if (');
  });

  it('keeps if statements when removing a branch would remove a hoisted binding', () => {
    const output = transformPlatform(
      `
        import { Platform } from 'react-native';
        if (Platform.OS === 'ios') {
          installIOS();
        } else {
          var installer = require('./install-android');
        }
        use(installer);
      `,
      'ios'
    );

    expect(output).toContain("if (Platform.OS === 'ios')");
    expect(output).toContain("require('./install-android')");
  });

  it('folds short-circuit platform branches without evaluating unreachable operands', () => {
    const output = transformPlatform(
      `
        import { Platform } from 'react-native';
        const accessory = Platform.OS === 'ios' && <Accessory />;
        const androidAccessory = Platform.OS === 'android' && missing();
        const fallback = Platform.OS === 'ios' || missing();
        const androidFallback = Platform.OS === 'android' || <Fallback />;
      `,
      'ios'
    );

    expect(output).toContain('const accessory = <Accessory />;');
    expect(output).toContain('const androidAccessory = false;');
    expect(output).toContain('const fallback = true;');
    expect(output).toContain('const androidFallback = <Fallback />;');
    expect(output).not.toContain('missing()');
  });

  it('does not replace writes to Platform.OS', () => {
    const output = transformPlatform(
      `
        import { Platform } from 'react-native';
        Platform.OS = 'android';
        Platform.OS++;
        delete Platform.OS;
        for (Platform.OS of platforms) {}
        ({ platform: Platform.OS } = source);
      `,
      'ios'
    );

    expect(output.match(/Platform\.OS/g)).toHaveLength(5);
  });

  it('preserves discarded value evaluations, order, duplicates, and present undefined', () => {
    const output = transformPlatform(
      `
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
      `,
      'ios'
    );
    const executable = output.replace(/^import .*;\n/, '');
    const globalObject: { result?: { calls: string[]; selected: unknown } } = {};
    new Function('globalThis', executable)(globalObject);

    expect(globalObject.result).toEqual({
      calls: ['first ios', 'android', 'second ios', 'native'],
      selected: undefined,
    });
    expect(output).not.toContain('Platform.select');
  });

  it('keeps unsafe select specs and unsupported Platform members unchanged', () => {
    const output = transformPlatform(
      `
      import { Platform } from 'react-native';
      const computed = Platform.select({ [key]: 'computed', ios: 'ios' });
      const spread = Platform.select({ ...spec, ios: 'ios' });
      const getter = Platform.select({ get ios() { return 'getter'; } });
      const setter = Platform.select({ set ios(value) {}, default: 'default' });
      const method = Platform.select({ ios() { return 'method'; } });
      const prototype = Platform.select({ __proto__: null, ios: 'ios' });
      const extraArgument = Platform.select({ ios: 'ios' }, sideEffect());
      const loose = Platform.OS == 'ios' ? 'yes' : 'no';
      const dynamic = Platform.OS === target ? 'yes' : 'no';
      const version = Platform.Version === 'ios' ? 'yes' : 'no';
      const constants = Platform.constants === 'ios' ? 'yes' : 'no';
    `,
      'ios'
    );

    expect(output.match(/Platform\.select\(/g)).toHaveLength(7);
    expect(output).toMatch(/["']ios["'] == 'ios'/);
    expect(output).toMatch(/["']ios["'] === target/);
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
