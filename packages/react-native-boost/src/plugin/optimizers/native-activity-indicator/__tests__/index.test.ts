import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { nativeActivityIndicatorOptimizer } from '..';
import type { BoostOptions, TargetPlatform } from '../../../types';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';

const transformActivityIndicator = (
  source: string,
  platform?: TargetPlatform,
  options: { unknownAncestorsDoNotRenderText?: boolean; unistylesEnabled?: boolean } = {}
): string => {
  const pluginOptions: BoostOptions = {
    assumptions: { unknownAncestorsDoNotRenderText: options.unknownAncestorsDoNotRenderText },
    integrations: { unistyles: options.unistylesEnabled ? 'on' : 'off' },
  };
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [
      '@babel/plugin-syntax-jsx',
      generateTestPlugin(nativeActivityIndicatorOptimizer, pluginOptions, platform),
    ],
  })!.code!;
};

const source = (element: string) => `import { ActivityIndicator } from 'react-native';\n${element};`;

describe('ActivityIndicator optimizer', () => {
  it('expands static iOS props into the two native hosts', () => {
    const output = transformActivityIndicator(
      source('<ActivityIndicator size="large" color="red" animating={false} testID="spinner" />'),
      'ios'
    );

    expect(output).toContain('<_NativeActivityIndicator');
    expect(output).toContain('<_NativeView style={_activityIndicatorStyles.container}>');
    expect(output).toContain('animating={false}');
    expect(output).toContain('color="red"');
    expect(output).toContain('hidesWhenStopped={true}');
    expect(output).toContain('style={_activityIndicatorStyles.large}');
    expect(output).toContain('size="large"');
    expect(output).not.toContain('processActivityIndicator');
  });

  it('inlines Android defaults and native ProgressBar props', () => {
    const output = transformActivityIndicator(source('<ActivityIndicator />'), 'android');

    expect(output).toContain('<_NativeActivityIndicator');
    expect(output).toContain('animating={true}');
    expect(output).toContain('color={null}');
    expect(output).toContain('styleAttr="Normal"');
    expect(output).toContain('indeterminate={true}');
  });

  it('uses runtime helpers only for dynamic wrapper props', () => {
    const output = transformActivityIndicator(
      `
        import { ActivityIndicator } from 'react-native';
        const animating = true;
        const color = 'red';
        const hides = false;
        const size = 24;
        const style = { margin: 4 };
        <ActivityIndicator animating={animating} color={color} hidesWhenStopped={hides} size={size} style={style} />;
      `,
      'ios'
    );

    expect(output).toContain('_resolveActivityIndicatorDefault(animating, true)');
    expect(output).toContain('_resolveActivityIndicatorDefault(color, "#999999")');
    expect(output).toContain('_resolveActivityIndicatorDefault(hides, true)');
    expect(output).toContain('{..._processActivityIndicatorSize(size)}');
    expect(output).toContain('style={_processActivityIndicatorStyle(style)}');
  });

  it('inlines static custom size and composed style objects', () => {
    const output = transformActivityIndicator(
      source('<ActivityIndicator size={24} style={{ margin: 4 }} />'),
      'android'
    );

    expect(output).toMatch(/style=\{\{\s*height: 24,\s*width: 24\s*\}\}/);
    expect(output).toMatch(/style=\{\[_activityIndicatorStyles\.container,\s*\{\s*margin: 4\s*\}\]\}/);
  });

  it.each([
    ['spread props', '<ActivityIndicator {...props} />'],
    ['children', '<ActivityIndicator><View /></ActivityIndicator>'],
    ['impure props', '<ActivityIndicator color={getColor()} />'],
    ['Text ancestor', '<Text><ActivityIndicator /></Text>'],
  ])('bails on %s', (_, element) => {
    const output = transformActivityIndicator(
      `import { ActivityIndicator, Text, View } from 'react-native';\n${element};`,
      'ios'
    );
    expect(output).not.toContain('_NativeActivityIndicator');
  });

  it('bails when the target platform is unknown or web', () => {
    expect(transformActivityIndicator(source('<ActivityIndicator />'))).not.toContain('_NativeActivityIndicator');
    expect(transformActivityIndicator(source('<ActivityIndicator />'), 'web')).not.toContain(
      '_NativeActivityIndicator'
    );
  });

  it('bails on Unistyles styles and permits the unknown ancestor assumption', () => {
    const unistyles = transformActivityIndicator(
      `
        import { ActivityIndicator } from 'react-native';
        import { StyleSheet } from 'react-native-unistyles';
        const styles = StyleSheet.create({ spinner: { margin: 4 } });
        <ActivityIndicator style={styles.spinner} />;
      `,
      'ios',
      { unistylesEnabled: true }
    );
    expect(unistyles).not.toContain('_NativeActivityIndicator');

    const assumed = transformActivityIndicator(
      `import { ActivityIndicator } from 'react-native'; import { Wrapper } from './wrapper'; <Wrapper><ActivityIndicator /></Wrapper>;`,
      'ios',
      { unknownAncestorsDoNotRenderText: true }
    );
    expect(assumed).toContain('_NativeActivityIndicator');
  });
});
