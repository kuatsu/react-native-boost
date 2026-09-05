import { type NodePath, types as t } from '@babel/core';
import { isStaticLiteralTree } from './common/attributes';

const reservedKeys = new Set(['__proto__', 'key', 'ref']);
const attributeName = /^[a-zA-Z_$][a-zA-Z0-9_$-]*$/;

export function openLiteralSpreads(path: NodePath<t.JSXOpeningElement>): void {
  if (!path.node.attributes.some((attribute) => t.isJSXSpreadAttribute(attribute))) return;
  const names = new Set<string>();
  const attributes: t.JSXAttribute[] = [];
  for (const attribute of path.node.attributes) {
    if (t.isJSXAttribute(attribute)) {
      if (!t.isJSXIdentifier(attribute.name)) return;
      const name = attribute.name.name;
      if (reservedKeys.has(name) || names.has(name)) return;
      if (t.isJSXElement(attribute.value) || t.isJSXFragment(attribute.value)) return;
      if (t.isJSXExpressionContainer(attribute.value)) {
        const value = attribute.value.expression;
        if (
          !path.scope.isPure(value) &&
          !(t.isIdentifier(value, { name: 'undefined' }) && !path.scope.getBinding('undefined'))
        )
          return;
      }
      names.add(name);
      attributes.push(attribute);
      continue;
    }
    if (!t.isObjectExpression(attribute.argument) || !isSafeLiteral(attribute.argument)) return;
    for (const property of attribute.argument.properties as t.ObjectProperty[]) {
      const name = t.isIdentifier(property.key) ? property.key.name : (property.key as t.StringLiteral).value;
      if (!attributeName.test(name) || names.has(name)) return;
      names.add(name);
      // Keep string expressions in containers; JSX text normalization changes whitespace and entities.
      attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(property.value as t.Expression)));
    }
  }
  path.node.attributes = attributes;
}

function isSafeLiteral(expression: t.ObjectExpression): boolean {
  if (!isStaticLiteralTree(expression)) return false;
  let safe = true;
  t.traverseFast(expression, (node) => {
    if (!t.isObjectExpression(node)) return;
    const names = new Set<string>();
    for (const property of node.properties as t.ObjectProperty[]) {
      const name = t.isIdentifier(property.key) ? property.key.name : (property.key as t.StringLiteral).value;
      if (reservedKeys.has(name) || names.has(name)) safe = false;
      names.add(name);
    }
  });
  return safe;
}
