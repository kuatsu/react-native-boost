import { createRequire } from 'node:module';
import { transformSync, type PluginItem, type PluginObj, type TransformCaller } from '@babel/core';
import compiler from 'babel-plugin-react-compiler';
import { describe, expect, it, vi } from 'vitest';
import boost from '../index';

const requireFromTest = createRequire(import.meta.url);
const boostPlugin: PluginItem = [
  boost,
  {
    logLevel: 'silent',
    target: { reactNative: { packageJson: requireFromTest.resolve('react-native/package.json') } },
  },
];

function transform(source: string, plugins: PluginItem[]) {
  return transformSync(source, {
    filename: 'screen.jsx',
    configFile: false,
    babelrc: false,
    caller: { name: 'test', platform: 'android' } as TransformCaller,
    plugins: ['@babel/plugin-syntax-jsx', ...plugins],
  })!.code!;
}

for (const compilerFirst of [true, false]) {
  describe(`React Compiler ${compilerFirst ? 'before' : 'after'} Boost`, () => {
    const plugins: PluginItem[] = compilerFirst ? [compiler, boostPlugin] : [boostPlugin, compiler];

    it('uses raw hosts inside a View but keeps context at the component boundary', () => {
      const code = transform(
        `
        import {View, Text} from 'react-native';
        export function Screen({value}) {
          return <View><View testID="inner"><Text>{value}</Text></View></View>;
        }
      `,
        plugins
      );
      expect(code).toContain('react/compiler-runtime');
      expect(code).toContain('<_NativeViewWithContext>');
      expect(code).toContain('<_NativeView testID="inner">');
    });

    it('resolves local forwarding components before lowering', () => {
      const code = transform(
        `
        import {View, Text} from 'react-native';
        function Box({children}) { return <View>{children}</View>; }
        export function Screen({value}) {
          return <Box><View testID="inner"><Text>{value}</Text></View></Box>;
        }
      `,
        plugins
      );
      expect(code).toContain('react/compiler-runtime');
      expect(code).toContain('<_NativeView testID="inner">');
    });

    it('does not retry children of an inspecting parent after hoisting', () => {
      const code = transform(
        `
        import React from 'react';
        import {View} from 'react-native';
        function Inspect({children}) { return React.cloneElement(children, {testID: children.type.name}); }
        export function Screen() { return <Inspect><View testID="keep" /></Inspect>; }
      `,
        plugins
      );
      expect(code).toContain('react/compiler-runtime');
      expect(code).toContain('<View testID="keep"');
      expect(code).not.toContain('react-native-boost/runtime');
    });

    it('keeps Text ancestry, prop guards, and ignore directives', () => {
      const code = transform(
        `
        import {View, Text} from 'react-native';
        export function Screen(props) {
          return <Text>
            <View testID="reset"><Text>label</Text></View>
            <View {...props} />
            {/* @boost-ignore */}<View testID="ignored" />
          </Text>;
        }
      `,
        plugins
      );
      expect(code).toContain('<_NativeViewWithContext testID="reset">');
      expect(code).toContain('<View {...props}');
      expect(code).toContain('<View testID="ignored"');
    });

    it('analyzes the live AST after earlier macros', () => {
      const macro: PluginObj = {
        visitor: {
          Program(path) {
            path.traverse({
              JSXIdentifier(child) {
                if (child.node.name === 'View' && child.parentPath.isJSXOpeningElement()) child.node.name = 'Unknown';
                if (child.node.name === 'View' && child.parentPath.isJSXClosingElement()) child.node.name = 'Unknown';
              },
            });
          },
        },
      };
      const code = transform(
        `
        import {View, Text} from 'react-native';
        export function Screen() { return <View><Text>label</Text></View>; }
      `,
        [macro, ...plugins]
      );
      expect(code).not.toContain('react-native-boost/runtime');
    });
  });
}

it('preserves an existing visitor wrapper', () => {
  const visited = vi.fn();
  transformSync(`import {View} from 'react-native'; export const Screen = () => <View />;`, {
    filename: 'screen.jsx',
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-syntax-jsx', compiler, boostPlugin],
    caller: { name: 'test', platform: 'android' } as TransformCaller,
    wrapPluginVisitorMethod(key, phase, visitor) {
      return function (this: unknown, path, state) {
        if (key === 'react-forget' && phase === 'enter' && path.isProgram()) visited();
        return visitor.call(this, path, state);
      };
    },
  });
  expect(visited).toHaveBeenCalledOnce();
});
