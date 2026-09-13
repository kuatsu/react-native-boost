import { transformSync, transformFromAstSync, traverse, types as t, type TransformCaller } from '@babel/core';
import { generateTestPlugin } from '../utils/generate-test-plugin';
import { nativeTextOptimizer } from '../optimizers/native-text';
import { nativeViewOptimizer } from '../optimizers/native-view';
import { nativeImageOptimizer } from '../optimizers/native-image';
import { buildPropertiesFromAttributes } from '../utils/common';
import compiler from 'babel-plugin-react-compiler';
import { describe, expect, it } from 'vitest';
import boost from '../index';
import type { PluginOptions } from '../types';

function emittedProps(
  component: 'Text' | 'View' | 'Image',
  props: string,
  platform: 'ios' | 'android',
  minor?: number
) {
  const optimizer = { Text: nativeTextOptimizer, View: nativeViewOptimizer, Image: nativeImageOptimizer }[component];
  const output = transformSync(
    `import {${component}} from 'react-native'; <${component} ${component === 'Image' ? 'src="logo.png"' : ''} ${props} />`,
    {
      configFile: false,
      babelrc: false,
      ast: true,
      parserOpts: { plugins: ['jsx'] },
      plugins: [generateTestPlugin(optimizer, {}, platform, minor)],
    }
  )!;
  let bag: t.ObjectExpression | undefined;
  traverse(output.ast!, {
    JSXOpeningElement(path) {
      if (!t.isJSXIdentifier(path.node.name) || !path.node.name.name.includes('Native' + component)) return;
      expect(path.node.attributes.some((attribute) => t.isJSXSpreadAttribute(attribute))).toBe(false);
      bag = buildPropertiesFromAttributes(
        path.node.attributes.filter(
          (attribute) =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name) &&
            /^(accessib|aria-|alt$|role$|disabled$|importantForAccessibility$)/.test(attribute.name.name)
        )
      );
    },
  });
  expect(bag).toBeDefined();
  const code = transformFromAstSync(t.file(t.program([t.expressionStatement(bag!)])), '', {
    configFile: false,
    babelrc: false,
  })!.code!;
  return new Function(`return ${code}`) as () => Record<string, unknown>;
}

for (const minor of [83, 84, 85, 86, 87, 88])
  for (const platform of ['ios', 'android'] as const) {
    it(`emits release-specific nulls and own keys on ${platform} RN ${minor}`, () => {
      const text = emittedProps(
        'Text',
        'aria-hidden={null} accessibilityElementsHidden={true} disabled={false} accessibilityState={{disabled:true,extra:"kept"}}',
        platform,
        minor
      );
      const first = text();
      expect(first.accessibilityElementsHidden).toBe(minor < 85 ? true : null);
      expect(Object.hasOwn(first, 'accessibilityLabel')).toBe(minor < 85);
      expect(Object.hasOwn(first, 'accessibilityRole')).toBe(minor === 84);
      expect(Object.hasOwn(first, 'role')).toBe(minor === 84);
      const roles = emittedProps(
        'Text',
        'aria-busy={true} accessibilityRole={null} role={undefined}',
        platform,
        minor
      )();
      expect(Object.hasOwn(roles, 'accessibilityRole')).toBe(minor < 85);
      expect(roles.accessibilityRole).toBe(minor === 83 ? null : undefined);
      expect(Object.hasOwn(first, 'importantForAccessibility')).toBe(minor < 85);
      expect(first.accessibilityState).toStrictEqual(
        minor >= 88
          ? { busy: undefined, checked: undefined, disabled: false, expanded: undefined, selected: undefined }
          : { disabled: false, extra: 'kept' }
      );
      expect(first.accessibilityState).not.toBe(text().accessibilityState);
      const image = emittedProps('Image', 'alt={null} accessible={false} accessibilityState={null}', platform, minor)();
      expect(image.accessible).toBe((platform === 'ios' && minor < 88) || minor < 85);
      expect(Object.hasOwn(image, 'accessibilityLabel')).toBe((platform === 'ios' && minor < 88) || minor < 85);
      expect(Object.hasOwn(image, 'accessibilityState')).toBe((platform === 'ios' && minor < 88) || minor < 85);
      if (platform === 'ios' && minor < 88) expect(image.accessibilityState).toBeNull();
      const view = emittedProps(
        'View',
        'aria-busy={null} aria-disabled={false} accessibilityState={{busy:true, extra:"removed"}} aria-valuenow={0} accessibilityValue={{text:null}}',
        platform,
        minor
      );
      expect(view().accessibilityState).toStrictEqual({
        busy: true,
        checked: undefined,
        disabled: false,
        expanded: undefined,
        selected: undefined,
      });
      expect(view().accessibilityValue).toStrictEqual({ max: undefined, min: undefined, now: 0, text: null });
      expect(view().accessibilityState).not.toBe(view().accessibilityState);
    });
  }

function transform(
  component: string,
  props: string,
  platform = 'ios',
  compile = false,
  preamble = '',
  options: PluginOptions = {},
  ignore = false
) {
  return transformSync(
    `import {Text,View,Image} from 'react-native'; ${preamble}
    export default function Case(value) {return <View>${ignore ? '{/* @boost-ignore */}' : ''}<${component} ${component === 'Image' ? 'src="logo.png"' : ''} ${props} /></View>}`,
    {
      configFile: false,
      babelrc: false,
      filename: 'static-accessibility.jsx',
      caller: { name: 'test', platform } as TransformCaller,
      parserOpts: { plugins: ['jsx'] },
      plugins: [...(compile ? [compiler] : []), [boost, { logLevel: 'silent', ...options }]],
    }
  )!.code!;
}

for (const platform of ['ios', 'android'])
  for (const compile of [false, true]) {
    describe(`static accessibility ${platform} compiler=${compile}`, () => {
      for (const component of ['Text', 'View', 'Image']) {
        it.each([
          'aria-busy={true} aria-selected={false}',
          'aria-busy={null} accessibilityState={{busy:false, disabled:true}}',
          'aria-busy={undefined} accessibilityState={null}',
          '{...{"aria-busy":true, accessibilityState:{selected:false}}}',
        ])(`folds ${component} %s`, (props) => {
          const output = transform(component, props, platform, compile);
          expect(output).toContain(`Native${component}`);
          expect(output).not.toContain(`<${component} `);
          expect(output).not.toContain(`process${component}AccessibilityProps`);
        });
        it.each([
          'aria-busy={value.busy} accessibilityState={{disabled:false}}',
          'aria-busy={true} accessibilityState={value.state}',
          'aria-busy={true} accessibilityState={{get disabled(){return false}}}',
          'aria-busy={true} accessibilityState={{["disabled"]:false}}',
          'aria-busy={true} accessibilityState={{disabled:false,disabled:true}}',
          'aria-busy={true} accessibilityState={{__proto__:null,disabled:false}}',
          'aria-busy={true} accessibilityState={{...value.state}}',
          'aria-busy={true} accessibilityState={{disabled:effect()}}',
          'aria-busy={<Unknown />}',
          'aria-busy=<Unknown />',
          'aria-busy={true} aria-busy={false}',
          'aria-busy={true} {...value}',
        ])(`does not fold ${component} %s`, (props) => {
          const output = transform(component, props, platform, compile);
          expect(output.includes(`<${component}`) || output.includes(`process${component}AccessibilityProps`)).toBe(
            true
          );
        });
      }
      it('keeps dynamic groups, shadowed undefined, and integration boundaries', () => {
        for (const component of ['Text', 'View', 'Image']) {
          const dynamic = transform(
            component,
            'aria-busy={busy} accessibilityState={{disabled:false}}',
            platform,
            compile,
            'const busy=globalThis.busy;'
          );
          expect(dynamic).toContain(`process${component}AccessibilityProps`);
          const shadowed = transform(
            component,
            'aria-busy={undefined}',
            platform,
            compile,
            'const undefined=globalThis.busy;'
          );
          expect(shadowed).toContain(`process${component}AccessibilityProps`);
          for (const target of ['web', 'unknown']) {
            const fallback = transform(component, 'aria-busy={true}', target, compile);
            expect(
              fallback.includes(`<${component}`) || fallback.includes(`process${component}AccessibilityProps`)
            ).toBe(true);
          }
          const off = transform(component, 'aria-busy={true}', platform, compile, '', {
            optimizations: { [`native-${component.toLowerCase()}`]: 'off' },
          });
          expect(off).toContain(`<${component}`);
          const ignored = transform(component, 'aria-busy={true}', platform, compile, '', {}, true);
          expect(ignored).toContain(`<${component}`);
          const uniwind = transform(component, 'aria-busy={true}', platform, compile, '', {
            integrations: { uniwind: 'on' },
          });
          expect(uniwind).toContain('react-native-boost/uniwind');
          expect(uniwind).toContain('aria-busy');
          const unistyles = transform(component, 'aria-busy={true}', platform, compile, '', {
            integrations: { unistyles: 'on' },
          });
          expect(unistyles).not.toContain(`process${component}AccessibilityProps`);
        }
      });
      it('folds Image string-array labels without a helper', () => {
        const output = transform(
          'Image',
          'aria-labelledby={null} accessibilityLabelledBy={["first","second"]}',
          platform,
          compile
        );
        expect(output).toContain('NativeImage');
        expect(output).not.toContain('processImageAccessibilityProps');
      });
      it('folds View values and Text disabled reconciliation', () => {
        expect(
          transform('View', 'aria-valuenow={0} accessibilityValue={{min:0,max:10,text:null}}', platform, compile)
        ).not.toContain('processViewAccessibilityProps');
        const text = transform('Text', 'disabled={false} accessibilityState={{disabled:true}}', platform, compile);
        expect(text).toContain('NativeText');
        expect(text).not.toContain('processTextAccessibilityProps');
      });
      it('does not inspect escaping const state or move its mutation', () => {
        const output = transform(
          'Text',
          'disabled={false} accessibilityState={state}',
          platform,
          compile,
          'const state={disabled:true}; escape(state);'
        );
        expect(output).not.toContain('NativeText');
      });
    });
  }
