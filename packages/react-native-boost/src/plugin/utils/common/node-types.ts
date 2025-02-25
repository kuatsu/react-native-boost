import { NodePath, types as t } from '@babel/core';

/**
 * Checks if a node represents a string value.
 */
export const isStringNode = (path: NodePath<t.JSXOpeningElement>, child: t.Node): boolean => {
  if (t.isJSXText(child) || t.isStringLiteral(child)) return true;

  // Check for JSX expressions
  if (t.isJSXExpressionContainer(child)) {
    const expression = child.expression;
    if (t.isIdentifier(expression)) {
      const binding = path.scope.getBinding(expression.name);
      if (binding && binding.path.node && t.isVariableDeclarator(binding.path.node)) {
        return !!binding.path.node.init && t.isStringLiteral(binding.path.node.init);
      }
      return false;
    }
    if (t.isStringLiteral(expression)) return true;
  }
  return false;
};
