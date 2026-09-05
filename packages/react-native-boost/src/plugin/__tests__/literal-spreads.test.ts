import { transformSync, types as t, type PluginObj, type TransformCaller } from '@babel/core';
import { openLiteralSpreads } from '../utils/literal-spreads';
import compiler from 'babel-plugin-react-compiler';
import { describe, expect, it } from 'vitest';
import boost from '../index';
import type { PluginOptions } from '../types';

function transform(jsx: string, compile = false, options: PluginOptions = {}, platform = 'ios', preamble = '') {
  return transformSync(
    `import {Text, View, Image, ActivityIndicator} from 'react-native'; ${preamble}
    export default function Case() { return <View>${jsx}</View>; }`,
    {
      filename: 'literal-spreads.jsx',
      configFile: false,
      babelrc: false,
      caller: { name: 'test', platform } as TransformCaller,
      parserOpts: { plugins: ['jsx'] },
      plugins: [...(compile ? [compiler] : []), [boost, { logLevel: 'silent', ...options }]],
    }
  )!.code!;
}

for (const compile of [false, true]) {
  describe(`literal JSX spreads (compiler=${compile})`, () => {
    it.each([
      ['Text', '{style: [{fontWeight: 400}, {fontWeight: 700}], numberOfLines: -2}'],
      ['View', '{id: "card", tabIndex: 0}'],
      ['Image', '{source: {uri: "https://example.com/a.png"}, style: {width: 20}}'],
      ['ActivityIndicator', '{size: "large", animating: false}'],
    ])('opens %s before host optimization', (component, props) => {
      const output = transform(`<${component} {...${props}} />`, compile);
      expect(output).toContain(`Native${component}`);
      expect(output).not.toContain('...{');
      if (component === 'View') expect(output).toContain('nativeID="card"');
    });

    it.each([
      '{id: "first", id: "last"}',
      '{key: "key", id: "card"}',
      '{ref: null, id: "card"}',
      '{__proto__: null, id: "card"}',
      '{get id() {return "card"}}',
      '{id() {}}',
      '{["id"]: "card"}',
      '{...{id: "card"}}',
      '{id: value}',
      '{id: helper()}',
      '{style: {__proto__: {opacity: 0.5}}, id: "card"}',
      '{style: {...value}, id: "card"}',
      '{style: {opacity: 0.5, opacity: 1}, id: "card"}',
      '{style: [,,], id: "card"}',
      '{"bad:key": 1, id: "card"}',
    ])('leaves unsafe spread %s closed', (props) => {
      const output = transform(`<Text {...${props}} />`, compile);
      expect(output).not.toContain('NativeText');
      expect(output).toContain('...');
    });

    it.each([
      'id="direct" {...{id: "spread"}}',
      '{...{id: "spread"}} id="direct"',
      '{...{id: "a"}} {...{id: "b"}}',
      '{...{id: "a"}} {...unknown}',
      '{...{id: "a"}} {...helper()}',
      'key="x" {...{id: "a"}}',
      'ref={null} {...{id: "a"}}',
      'testID={effect()} {...{id: "a"}}',
    ])('does not open collisions or unsafe neighbors: %s', (attributes) => {
      const output = transform(`<Text ${attributes}>label</Text>`, compile);
      expect(output).not.toContain('NativeText');
    });

    it('keeps Image callback and Text mutation checks', () => {
      expect(transform('<Image {...{src:"x"}} onLoad={() => {}} />', compile)).toContain('NativeImage');
      expect(transform('<Image {...{src:"x", onLoad: null}} />', compile)).toContain('NativeImage');
      expect(transform('<Image {...{source:{uri:"logo.png"}}} onLoad={null} />', compile, {}, 'android')).not.toContain(
        'onLoad'
      );
      expect(transform('<Image {...{src:"x", onLoad: () => {}}} />', compile)).not.toContain('NativeImage');
      expect(transform('<Image {...{src:"x"}} onLoad={handler} />', compile)).not.toContain('NativeImage');
      expect(
        transform(
          '<Text {...{disabled: false}} accessibilityState={state}>label</Text>',
          compile,
          {},
          'ios',
          'const state = {disabled: true};'
        )
      ).not.toContain('NativeText');
      expect(
        transform('<Text {...{disabled: false, accessibilityState: {disabled: true}}}>label</Text>', compile)
      ).toContain('NativeText');
    });

    it('keeps unknown ancestors unsafe after compiler lowering', () => {
      const output = transform(
        '<Parent><Text {...{style:{color:"red"}}}>label</Text><Image {...{src:"x"}} onLoad={() => {}} /></Parent>',
        compile,
        {},
        'ios',
        'import Parent from "unknown-parent";'
      );
      expect(output).not.toContain('NativeText');
      expect(output).not.toContain('NativeImage');
    });

    it('respects ignore, off, web and integration routing', () => {
      expect(transform('{/* @boost-ignore */}<Text {...{style:{color:"red"}}}>label</Text>', compile)).not.toContain(
        'NativeText'
      );
      const off = transform('<Text {...{style:{color:"red"}}}>label</Text>', compile, {
        optimizations: { 'native-text': 'off' },
      });
      expect(off).not.toContain('NativeText');
      expect(off).toContain('...');
      for (const platform of ['web', 'unknown']) {
        expect(transform('<Text {...{id:"label"}}>label</Text>', compile, {}, platform)).not.toContain('NativeText');
      }
      expect(transform('<Image {...{src:"x"}} />', compile, {}, 'web')).not.toContain('NativeImage');
      expect(transform('<Image {...{src:"x"}} />', compile, {}, 'unknown')).not.toContain('NativeImage');
      expect(
        transform('<Text {...{style:{color:"red"}}}>label</Text>', compile, { integrations: { uniwind: 'on' } })
      ).toContain('react-native-boost/uniwind');
      expect(
        transform('<Text {...{style:{color:"red"}}}>label</Text>', compile, { integrations: { unistyles: 'on' } })
      ).toContain('NativeText');
    });
  });
}

it('opens in place without cloning, hoisting, or changing string expression shape', () => {
  let checked = false;
  transformSync(
    String.raw`const Case = () => <Text first="a" {...{testID:"a\n b &amp;", style:[{color:"red"},{color:"blue"}]}} last="z" />;`,
    {
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['jsx'] },
      plugins: [
        (): PluginObj => ({
          visitor: {
            JSXOpeningElement(path) {
              const [first, spread, last] = path.node.attributes;
              if (!t.isJSXSpreadAttribute(spread) || !t.isObjectExpression(spread.argument))
                throw new Error('spread expected');
              const values = spread.argument.properties.map((property) => (property as t.ObjectProperty).value);
              openLiteralSpreads(path);
              expect(path.node.attributes[0]).toBe(first);
              expect(path.node.attributes[3]).toBe(last);
              for (const [index, value] of values.entries()) {
                const attribute = path.node.attributes[index + 1] as t.JSXAttribute;
                expect(t.isJSXExpressionContainer(attribute.value) && attribute.value.expression).toBe(value);
              }
              expect(path.getFunctionParent()).not.toBeNull();
              checked = true;
            },
          },
        }),
      ],
    }
  );
  expect(checked).toBe(true);
});

it('preserves disjoint attributes and wrapper alias precedence', () => {
  const output = transform(
    '<Text nativeID="fallback" {...{id:"winner", selectable:false, style:[{color:"red"},{color:"blue",userSelect:"text"}]}} testID="last">label</Text>'
  );
  expect(output).toContain('nativeID={"winner"}');
  expect(output).not.toContain('fallback');
  expect(output).toContain('selectable={true}');
  expect(output).toContain('color: "red"');
  expect(output).toContain('color: "blue"');
  expect(output).not.toContain('processTextStyle');
});
