import { transformSync, type TransformCaller } from '@babel/core';
import { describe, expect, it, vi } from 'vitest';
import boostPlugin from '../../index';
import { validatePluginOptions } from '../options';

describe('plugin options', () => {
  it('accepts the current configuration', () => {
    const options = {
      optimizations: {
        'native-image': 'off' as const,
        'animated-value-initialization': 'on' as const,
        'animated-wrapper-removal': 'on' as const,
        'stylesheet-operations': 'on' as const,
        'platform-folding': 'on' as const,
      },
      assumptions: { unknownAncestorsDoNotRenderText: true },
      integrations: { unistyles: 'on' as const },
      ignores: ['node_modules/**'],
      logLevel: 'info' as const,
      target: { reactNative: { packageJson: '/react-native/package.json' } },
    };

    expect(validatePluginOptions(options)).toEqual(options);
  });

  it('ignores an unmigrated Metro plugin and asks the user to move its old options', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const output = transformSync(`import { Text } from 'react-native'; <Text>Hello</Text>;`, {
      configFile: false,
      babelrc: false,
      caller: { name: 'metro', bundler: 'metro', platform: 'ios' } as TransformCaller,
      plugins: ['@babel/plugin-syntax-jsx', [boostPlugin, { verbose: true, optimizations: { text: false } }]],
    })!.code!;

    expect(output).not.toContain('NativeText');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Move your options to withBoostConfig'));
    log.mockRestore();
  });

  it('runs only the Metro-injected plugin when a manual copy is also configured', () => {
    const output = transformSync(`import { Text } from 'react-native'; <Text>Hello</Text>;`, {
      configFile: false,
      babelrc: false,
      caller: { name: 'metro', bundler: 'metro', platform: 'ios' } as TransformCaller,
      plugins: [
        '@babel/plugin-syntax-jsx',
        [boostPlugin, {}, 'manual'],
        [boostPlugin, { logLevel: 'silent', __reactNativeBoost: 'injected' }, 'injected'],
      ],
    })!.code!;

    expect(output).toContain('NativeText');
  });

  it('accepts a React Native package target', () => {
    expect(validatePluginOptions({ target: { reactNative: { packageJson: '/react-native/package.json' } } })).toEqual({
      target: { reactNative: { packageJson: '/react-native/package.json' } },
    });
  });

  it('disables an optimization with its public name', () => {
    const output = transformSync(`import { Text } from 'react-native'; <Text>Hello</Text>;`, {
      configFile: false,
      babelrc: false,
      plugins: [
        '@babel/plugin-syntax-jsx',
        [boostPlugin, { logLevel: 'silent', optimizations: { 'native-text': 'off' } }],
      ],
    })!.code!;

    expect(output).toContain('<Text>Hello</Text>');
    expect(output).not.toContain('NativeText');
  });

  it.each([
    [{ silent: true }, 'Use `logLevel` instead.'],
    [{ unistyles: true }, 'Use `integrations.unistyles` instead.'],
    [
      { dangerouslyOptimizeTextWithUnknownAncestors: true },
      'Use `assumptions.unknownAncestorsDoNotRenderText` instead.',
    ],
    [{ optimizations: { text: false } }, 'Use `native-text` instead.'],
  ])('rejects removed configuration %#', (options, message) => {
    expect(() => validatePluginOptions(options)).toThrow(message);
  });

  it.each([
    [{ unknown: true }, 'Unknown plugin option `unknown`.'],
    [{ optimizations: { unknown: 'on' } }, 'Unknown optimization `unknown`.'],
    [{ assumptions: { unknown: true } }, 'Unknown assumption `unknown`.'],
    [{ integrations: { unknown: 'on' } }, 'Unknown integration `unknown`.'],
    [{ logLevel: 'verbose' }, '`logLevel` must be one of'],
    [{ optimizations: { 'native-text': true } }, 'must be `on` or `off`'],
    [{ integrations: { unistyles: true } }, 'must be `auto`, `on`, or `off`'],
    [{ target: { reactNative: {} } }, '`target.reactNative.packageJson` must be a non-empty string'],
    [{ target: { reactNative: { packageJson: '' } } }, '`target.reactNative.packageJson` must be a non-empty string'],
    [{ target: { reactNative: { version: '0.87.1' } } }, 'Unknown `target.reactNative` option `version`'],
  ])('rejects invalid configuration %#', (options, message) => {
    expect(() => validatePluginOptions(options)).toThrow(message);
  });
});
