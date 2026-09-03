import { transformSync, type TransformCaller } from '@babel/core';
import { describe, expect, it } from 'vitest';
import boostPlugin from '../../../index';
import { generateTestPlugin } from '../../../utils/generate-test-plugin';
import { stylesheetOperationsOptimizer } from '..';

function transform(source: string): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [generateTestPlugin(stylesheetOperationsOptimizer, {}, 'ios')],
  })!.code!;
}

function transformWithBoost(
  source: string,
  options: Record<string, unknown> = {},
  filename = '/app/source.js'
): string {
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    filename,
    caller: { name: 'test', platform: 'ios' } as TransformCaller,
    plugins: [
      [
        boostPlugin,
        {
          logLevel: 'silent',
          target: { reactNative: { version: '0.87.1' } },
          ...options,
        },
      ],
    ],
  })!.code!;
}

const importStyleSheet = `import { StyleSheet } from 'react-native';`;

describe('StyleSheet operations optimizer', () => {
  it('flattens static nested arrays with React Native precedence', () => {
    const output = transform(`
      ${importStyleSheet}
      function makeStyle() {
        return StyleSheet.flatten([
          { padding: 8, color: 'red', transform: [{ scale: 2 }] },
          null,
          false,
          [{ color: 'blue' }, { opacity: 0.5 }],
        ]);
      }
    `);

    expect(output).not.toContain('StyleSheet.flatten([');
    expect(output).toMatch(
      /StyleSheet\.flatten, \{\s*padding: 8,\s*color: ['"]blue['"],\s*transform: \[\{\s*scale: 2\s*\}\],\s*opacity: 0\.5\s*\}/
    );
  });

  it('preserves compose identity and allocation behavior', () => {
    const output = transform(`
      ${importStyleSheet}
      export function composeWithNull(style) {
        return StyleSheet.compose(null, style);
      }
      export function composeStatic() {
        return StyleSheet.compose({ color: 'red' }, { opacity: 1 });
      }
    `);

    expect(output).toContain('StyleSheet.compose, style');
    expect(output).toMatch(/StyleSheet\.compose, \[\{\s*color: ['"]red['"]\s*\}, \{\s*opacity: 1\s*\}\]/);
  });

  it('keeps dynamic operations unless they are forced', () => {
    const regular = transform(`
      ${importStyleSheet}
      function flatten(styles) {
        return StyleSheet.flatten(styles);
      }
      function compose(first, second) {
        return StyleSheet.compose(first, second);
      }
    `);
    const forced = transform(`
      ${importStyleSheet}
      function flatten(styles) {
        /* @boost-force */
        return StyleSheet.flatten(styles);
      }
      function compose(first, second) {
        /* @boost-force */
        return StyleSheet.compose(first, second);
      }
    `);

    expect(regular).toContain('StyleSheet.flatten(styles)');
    expect(regular).toContain('StyleSheet.compose(first, second)');
    expect(forced).not.toContain('StyleSheet.flatten(styles)');
    expect(forced).not.toContain('StyleSheet.compose(first, second)');
    expect(forced).toContain('StyleSheet.flatten, styles');
    expect(forced).toMatch(/StyleSheet\.compose, \[first, second\]/);
  });

  it('honors @boost-ignore and does not guess about shadowed undefined', () => {
    const output = transform(`
      ${importStyleSheet}
      /* @boost-ignore */
      const ignored = StyleSheet.flatten([{ color: 'red' }]);
      function flatten(undefined) {
        return StyleSheet.flatten([undefined, { opacity: 1 }]);
      }
    `);

    expect(output).toContain('StyleSheet.flatten([{');
    expect(output.match(/StyleSheet\.flatten\(/g)).toHaveLength(2);
  });

  it('requires the React Native StyleSheet binding and supports aliases', () => {
    const output = transform(`
      import { StyleSheet as RNStyleSheet } from 'react-native';
      import { StyleSheet } from 'other-library';
      const optimized = RNStyleSheet.flatten([{ opacity: 1 }]);
      const untouched = StyleSheet.flatten([{ opacity: 1 }]);
    `);

    expect(output).toContain('RNStyleSheet.flatten, {');
    expect(output).toContain('StyleSheet.flatten([{');
  });

  it('runs through the general plugin visitor and respects configuration and file ignores', () => {
    const source = `${importStyleSheet}\nconst style = StyleSheet.flatten([{ opacity: 1 }]);`;

    expect(transformWithBoost(source)).toContain('StyleSheet.flatten, {');
    expect(transformWithBoost(source, { optimizations: { 'stylesheet-operations': 'off' } })).toContain(
      'StyleSheet.flatten([{'
    );
    expect(transformWithBoost(source, { ignores: ['/app/ignored.js'] }, '/app/ignored.js')).toContain(
      'StyleSheet.flatten([{'
    );
  });
});
