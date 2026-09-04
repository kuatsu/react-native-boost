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

  it('preserves spreads and plain attributes in an object literal', () => {
    const node = buildPropertiesFromAttributes([
      spread('props'),
      attribute('accessibilityRole', t.stringLiteral('button')),
    ]);

    expect(node.properties).toHaveLength(2);
    const [spreadProperty, roleProperty] = node.properties;
    expect(t.isSpreadElement(spreadProperty)).toBe(true);
    expect(t.isIdentifier((spreadProperty as t.SpreadElement).argument, { name: 'props' })).toBe(true);
    expect(t.isObjectProperty(roleProperty)).toBe(true);
    expect(t.isIdentifier((roleProperty as t.ObjectProperty).key, { name: 'accessibilityRole' })).toBe(true);
  });
});
