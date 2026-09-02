import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../index';
import { validatePluginOptions } from '../options';

describe('plugin options', () => {
  it('accepts the current configuration', () => {
    const options = {
      optimizations: { 'native-image': 'off' as const },
      assumptions: { unknownAncestorsDoNotRenderText: true },
      integrations: { unistyles: 'on' as const },
      ignores: ['node_modules/**'],
      logLevel: 'info' as const,
    };

    expect(validatePluginOptions(options)).toEqual(options);
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
  ])('rejects invalid configuration %#', (options, message) => {
    expect(() => validatePluginOptions(options)).toThrow(message);
  });
});
