import { transformSync, type PluginObj } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { analyzeSpreadExports } from '../returned-props';

function keys(source: string) {
  let result: ReturnType<typeof analyzeSpreadExports> | undefined;
  transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: [
      '@babel/plugin-syntax-jsx',
      ['@babel/plugin-syntax-typescript', { isTSX: true }],
      (): PluginObj => ({
        visitor: {
          Program(path) {
            result = analyzeSpreadExports(path);
          },
        },
      }),
    ],
  });
  return result;
}

describe('returned prop keys', () => {
  it('unions fresh object returns and fixed-key writes without reading types', () => {
    expect(
      keys(`
      export function props(enabled: boolean, index?: number): Record<string, unknown> {
        if (!enabled) return {};
        const result = {role: 'cell'};
        if (index !== undefined) result['aria-colindex'] = index;
        return result;
      }
    `)
    ).toEqual({ props: ['aria-colindex', 'role'] });
  });

  it('supports conditional, empty, default, and imported exports', () => {
    expect(
      keys(`
      export const props = (flag) => flag ? {testID: 'a'} : null;
      export default function empty() {}
      export {props as forwarded} from './props';
      import other from './other'; export {other};
    `)
    ).toEqual({
      props: ['testID'],
      default: [],
      forwarded: { kind: 'import', source: './props', imported: 'props' },
      other: { kind: 'import', source: './other', imported: 'default' },
    });
  });

  it('keeps namespace exports from falling through to export-star helpers', () => {
    expect(keys(`export * as props from './other'; export * from './fallback';`)).toEqual({ props: null });
  });

  it.each([
    `return input;`,
    `return external();`,
    `return { ...input };`,
    `return { [input]: true };`,
    `return { get testID() { return input; } };`,
    `return { __proto__: input };`,
    `const result = {}; result[input] = true; return result;`,
    `const result = {}; result.__proto__ = input; return result;`,
    `const result = {}; Object.assign(result, input); return result;`,
    `const result = {}; const alias = result; alias.ref = input; return result;`,
    `const result = {}; external(result); return result;`,
    `const result = {}; const mutate = () => { result.ref = input; }; mutate(); return result;`,
    `const result = {}; eval('result.ref = input'); return result;`,
    `const result = {}; function mutate() { eval('result.ref = input'); } mutate(); return result;`,
    `let result = {}; result = input; return result;`,
    `try { return {}; } finally { return input; }`,
    `return shared;`,
  ])('rejects an unproved return: %s', (body) => {
    expect(keys(`const shared = {}; export function props(input) { ${body} }`)).toEqual({ props: null });
  });

  it.each([
    `export async function props() { return {}; }`,
    `export function* props() { return {}; }`,
    `export function props() { return {}; } props = external;`,
    `export default function props() { return {}; } props = external;`,
  ])('rejects a non-plain or reassigned helper: %s', (source) => {
    expect(Object.values(keys(source)!)).toEqual([null]);
  });
});
