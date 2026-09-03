import { transformSync, type TransformCaller } from '@babel/core';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { staticAnimatedOptimizer } from '..';
import type { TargetPlatform } from '../../../types';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';

function transformAnimated(source: string, platform: TargetPlatform = 'ios'): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-syntax-jsx', generateTestPlugin(staticAnimatedOptimizer, {}, platform)],
  })!.code!;
}

function transformWithBoost(source: string, reactNativeMinor = 86, staticAnimated?: 'on' | 'off'): string {
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
          target: { reactNative: { version: `0.${reactNativeMinor}.0` } },
          assumptions: { unknownAncestorsDoNotRenderText: true },
          optimizations: staticAnimated ? { 'static-animated': staticAnimated } : undefined,
        },
      ],
    ],
  })!.code!;
}

const source = (element: string) => `import { Animated } from 'react-native';\n${element};`;
const bailoutCases = [
  ['dynamic style', '<Animated.View style={{ opacity: value }} />'],
  ['Animated event', '<Animated.ScrollView onScroll={Animated.event([], { useNativeDriver: true })} />'],
  ['spread props', '<Animated.View {...props} />'],
  ['ref', '<Animated.View ref={ref} />'],
  ['passthrough values', '<Animated.View passthroughAnimatedPropExplicitValues={{ style: { opacity: 1 } }} />'],
  ['dynamic child', '<Animated.Text>{value}</Animated.Text>'],
  ['ScrollView refresh control', '<Animated.ScrollView refreshControl={<RefreshControl />} />'],
];

describe('static Animated optimizer', () => {
  it('lowers static Animated.View and reproduces Animated style flattening', () => {
    const output = transformAnimated(
      source(
        '<Animated.View collapsable={true} testID="card" style={[{ width: 12, opacity: 1 }, null, false, [{ opacity: 0.5 }]]} />'
      )
    );

    expect(output).not.toContain('<Animated.View');
    expect(output).toContain('<_StaticAnimatedView testID="card" collapsable={false}');
    expect(output).toMatch(/style=\{\{\s*width: 12,\s*opacity: 0\.5\s*\}\}/);
  });

  it('preserves the hidden style and ScrollView defaults', () => {
    const output = transformAnimated(
      source(
        '<><Animated.View /><Animated.Text style={null}>x</Animated.Text><Animated.ScrollView /><Animated.ScrollView scrollEventThrottle={16} /></>'
      )
    );

    expect(output.match(/style=\{undefined\}/g)).toHaveLength(4);
    expect(output.match(/scrollEventThrottle=\{0\.0001\}/g)).toHaveLength(1);
    expect(output.match(/scrollEventThrottle=\{16\}/g)).toHaveLength(1);
    expect(output.match(/collapsable=\{false\}/g)).toHaveLength(4);
  });

  it('accepts aliases, static objects, JSX children, and proven function callbacks', () => {
    const output = transformAnimated(`
      import { Animated as Motion } from 'react-native';
      function onLayout() {}
      <Motion.View accessibilityState={{ disabled: false }} onLayout={onLayout}>
        <Child />
      </Motion.View>;
    `);

    expect(output).toContain('<_StaticAnimatedView accessibilityState={{');
    expect(output).toContain('onLayout={onLayout}');
    expect(output).toContain('<Child />');
    expect(output).not.toContain('<Motion.View');
  });

  it('feeds lowered components into the native host optimizers', () => {
    const output = transformWithBoost(`
      import { Animated } from 'react-native';
      function Case() {
        return (
          <Animated.View style={{ width: 12 }}>
            <Animated.Text>Ready</Animated.Text>
            <Animated.Image source={{ uri: 'logo.png' }} />
          </Animated.View>
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
      import { Animated, Text } from 'react-native';
      function Case() {
        return <Animated.Text><Text>nested</Text></Animated.Text>;
      }
    `);

    expect(output).not.toContain('NativeText');
    expect(output).not.toContain('NativeVirtualText');
    expect(output).toContain('<_StaticAnimatedText collapsable={false} style={undefined}>');
    expect(output).toContain('<Text>nested</Text>');
  });

  it.each(bailoutCases)('bails on %s', (_, element) => {
    expect(transformAnimated(source(element))).toContain('<Animated.');
  });

  it.each(bailoutCases)('lets @boost-force override the %s bailout', (_, element) => {
    expect(transformAnimated(source(`<>{/* @boost-force */}${element}</>`))).not.toContain('<Animated.');
  });

  it('ignores local and deep Animated bindings', () => {
    const local = transformAnimated(`const Animated = library; <Animated.View />;`);
    const deep = transformAnimated(
      `import Animated from 'react-native/Libraries/Animated/Animated'; <Animated.View />;`
    );

    expect(local).toContain('<Animated.View');
    expect(deep).toContain('<Animated.View');
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

  it('respects @boost-ignore and unsupported platforms', () => {
    expect(transformAnimated(source('<>{/* @boost-ignore */}<Animated.View /></>'))).toContain('<Animated.View');
    expect(transformAnimated(source('<Animated.View />'), 'web')).toContain('<Animated.View');
    expect(transformAnimated(source('<>{/* @boost-force */}<Animated.View /></>'), 'web')).toContain('<Animated.View');
  });
});
