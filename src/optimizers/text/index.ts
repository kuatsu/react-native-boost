import { NodePath, types as t } from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import { Optimizer } from '../../types';

export const textOptimizer: Optimizer = (path) => {
  // Ensure we're processing a JSX element
  if (!t.isJSXIdentifier(path.node.name)) return;

  const parent = path.parent;
  if (!t.isJSXElement(parent)) return;

  const elementName = path.node.name.name;
  if (elementName !== 'Text') return;

  // Ensure Text element comes from react-native
  const binding = path.scope.getBinding(elementName);
  if (!binding) return;
  if (binding.kind === 'module') {
    const parentNode = binding.path.parent;
    if (!t.isImportDeclaration(parentNode) || parentNode.source.value !== 'react-native') {
      return;
    }
  }

  // Bail if the element has any blacklisted properties or non-string children props
  if (hasBlacklistedProperties(path)) return;
  if (!hasOnlyStringChildren(path, parent)) return;
  // TODO: Don't bail if the element has a style prop

  // Add NativeTextComponent import (cached on file) so we only add it once per file
  const file = (path.hub as unknown as { file: t.File }).file as t.File & {
    __nativeTextImport?: t.Identifier;
  };
  if (!file.__nativeTextImport) {
    file.__nativeTextImport = addNamed(path, 'NativeText', 'react-native/Libraries/Text/TextNativeComponent');
  }
  const nativeTextIdentifier = file.__nativeTextImport;
  path.node.name.name = nativeTextIdentifier.name;

  // If the element is not self-closing, update the closing element as well
  if (
    !path.node.selfClosing &&
    parent.closingElement &&
    t.isJSXIdentifier(parent.closingElement.name) &&
    parent.closingElement.name.name === 'Text'
  ) {
    parent.closingElement.name.name = nativeTextIdentifier.name;
  }
};

function hasOnlyStringChildren(path: NodePath<t.JSXOpeningElement>, node: t.JSXElement): boolean {
  return node.children.every((child) => isStringNode(path, child));
}

function isStringNode(path: NodePath<t.JSXOpeningElement>, child: t.Node): boolean {
  if (t.isJSXText(child)) return true;

  // Check for JSX expressions
  if (t.isJSXExpressionContainer(child)) {
    const expression = child.expression;

    // If the expression is an identifier, look it up in the current scope
    if (t.isIdentifier(expression)) {
      const binding = path.scope.getBinding(expression.name);
      return binding ? t.isStringLiteral(binding.path.node) : false;
    }
  }
  return false;
}

const blacklistedProperties = new Set([
  'accessible',
  'accessibilityLabel',
  'accessibilityState',
  'allowFontScaling',
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-label',
  'aria-selected',
  'ellipsizeMode',
  'id',
  'nativeID',
  'onLongPress',
  'onPress',
  'onPressIn',
  'onPressOut',
  'onResponderGrant',
  'onResponderMove',
  'onResponderRelease',
  'onResponderTerminate',
  'onResponderTerminationRequest',
  'onStartShouldSetResponder',
  'pressRetentionOffset',
  'suppressHighlighting',
  'style',
]);

function hasBlacklistedProperties(path: NodePath<t.JSXOpeningElement>): boolean {
  return path.node.attributes.some((attribute) => {
    if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        if (binding && t.isObjectExpression(binding.path.node)) {
          return binding.path.node.properties.some((property) => {
            if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
              return blacklistedProperties.has(property.key.name);
            }
            return false;
          });
        }
      }
      // Bail if we can't resolve the spread attribute
      return true;
    }

    if (t.isJSXIdentifier(attribute.name) && attribute.value) {
      // For a "children" attribute, optimization is allowed only if it is a string
      if (attribute.name.name === 'children') {
        return isStringNode(path, attribute.value);
      }
      return blacklistedProperties.has(attribute.name.name);
    }

    // For other attribute types (e.g. namespaced), assume no blacklisting
    return false;
  });
}
