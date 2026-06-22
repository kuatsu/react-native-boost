import { describe, it, expect } from 'vitest';
import { types as t } from '@babel/core';
import { buildPropertiesFromAttributes } from '../attributes';

const attribute = (name: string, value?: t.JSXAttribute['value']): t.JSXAttribute =>
  t.jsxAttribute(t.jsxIdentifier(name), value ?? null);

const spread = (name: string): t.JSXSpreadAttribute => t.jsxSpreadAttribute(t.identifier(name));

describe('buildPropertiesFromAttributes', () => {
  it('returns an empty object literal for no attributes', () => {
    const node = buildPropertiesFromAttributes([]);
    expect(t.isObjectExpression(node)).toBe(true);
    expect((node as t.ObjectExpression).properties).toHaveLength(0);
  });

  it('returns a plain object literal when every attribute is a plain JSXAttribute', () => {
    const node = buildPropertiesFromAttributes([
      attribute('accessibilityLabel', t.stringLiteral('test')),
      attribute('disabled'), // boolean shorthand
    ]);

    expect(t.isObjectExpression(node)).toBe(true);
    const properties = (node as t.ObjectExpression).properties as t.ObjectProperty[];
    expect(properties).toHaveLength(2);

    const [label, disabled] = properties;
    expect(t.isIdentifier(label.key, { name: 'accessibilityLabel' })).toBe(true);
    expect(t.isStringLiteral(label.value, { value: 'test' })).toBe(true);
    expect(t.isIdentifier(disabled.key, { name: 'disabled' })).toBe(true);
    expect(t.isBooleanLiteral(disabled.value, { value: true })).toBe(true);
  });

  it('uses a string-literal property key for a non-identifier attribute name', () => {
    const node = buildPropertiesFromAttributes([attribute('aria-label', t.stringLiteral('x'))]);
    const [property] = (node as t.ObjectExpression).properties as t.ObjectProperty[];
    expect(t.isStringLiteral(property.key, { value: 'aria-label' })).toBe(true);
  });

  it('preserves source order of the attributes', () => {
    const node = buildPropertiesFromAttributes([
      attribute('a', t.stringLiteral('1')),
      attribute('b', t.stringLiteral('2')),
    ]);
    const keys = ((node as t.ObjectExpression).properties as t.ObjectProperty[]).map(
      (property) => (property.key as t.Identifier).name
    );
    expect(keys).toEqual(['a', 'b']);
  });

  it('returns an Object.assign call when any attribute is a spread', () => {
    const node = buildPropertiesFromAttributes([
      spread('props'),
      attribute('accessibilityRole', t.stringLiteral('button')),
    ]);

    expect(t.isCallExpression(node)).toBe(true);
    const call = node as t.CallExpression;
    const callee = call.callee as t.MemberExpression;
    expect(t.isIdentifier(callee.object, { name: 'Object' })).toBe(true);
    expect(t.isIdentifier(callee.property, { name: 'assign' })).toBe(true);

    // Args: {} target, the bare spread argument, then one single-key object per plain attribute.
    expect(call.arguments).toHaveLength(3);
    const target = call.arguments[0] as t.ObjectExpression;
    expect(t.isObjectExpression(target)).toBe(true);
    expect(target.properties).toHaveLength(0);
    expect(t.isIdentifier(call.arguments[1], { name: 'props' })).toBe(true);
    const lastArg = call.arguments[2] as t.ObjectExpression;
    expect(t.isObjectExpression(lastArg)).toBe(true);
    expect(lastArg.properties).toHaveLength(1);
  });
});
