import { describe, it, expect } from 'vitest';
import { transformSync, type TransformCaller } from '@babel/core';
import boostPlugin from '../index';

// Compile a bare `<Text>` (common path: no accessibility props) with the given Babel caller platform,
// mirroring how Metro invokes the plugin per platform bundle.
const compile = (platform?: string): string =>
  transformSync(`import { Text } from 'react-native';\nexport default () => <Text>hi</Text>;`, {
    configFile: false,
    babelrc: false,
    filename: 'case.jsx',
    caller: (platform ? { name: 'metro', platform } : { name: 'test' }) as TransformCaller,
    plugins: ['@babel/plugin-syntax-jsx', [boostPlugin, { silent: true }]],
  })!.code!;

describe('build-time `accessible` default', () => {
  it('inlines accessible={true} for iOS without importing the runtime resolver', () => {
    const code = compile('ios');
    expect(code).toContain('accessible={true}');
    expect(code).not.toContain('getDefaultTextAccessible');
  });

  it('inlines accessible={false} for Android without importing the runtime resolver', () => {
    const code = compile('android');
    expect(code).toContain('accessible={false}');
    expect(code).not.toContain('getDefaultTextAccessible');
  });

  it('omits the accessible default entirely on web (default is undefined there)', () => {
    const code = compile('web');
    expect(code).not.toContain('accessible');
    expect(code).not.toContain('getDefaultTextAccessible');
  });

  it('falls back to the runtime resolver when the platform is unknown', () => {
    const code = compile();
    expect(code).toContain('accessible={_getDefaultTextAccessible()}');
  });
});
