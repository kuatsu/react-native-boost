import { NodePath, types as t } from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { hasBlacklistedProperty, shouldIgnoreOptimization } from '../../utils/common';

export const textBlacklistedProperties = new Set([
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
  'selectable',
  'selectionColor',
]);

export const textOptimizer: Optimizer = (path, log = () => {}) => {
  // Ensure we're processing a JSX Text element
  if (!t.isJSXIdentifier(path.node.name)) return;

  const parent = path.parent;
  if (!t.isJSXElement(parent)) return;

  const elementName = path.node.name.name;
  if (elementName !== 'Text') return;

  // If the component is preceded by an ignore comment, do not optimize.
  if (shouldIgnoreOptimization(path)) {
    return;
  }

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
  if (hasBlacklistedProperty(path, textBlacklistedProperties)) return;
  if (hasInvalidChildren(path)) return;
  if (!hasOnlyStringChildren(path, parent)) return;

  // Extract the file from the Babel hub and add flags for logging & import caching
  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const filename = file.opts?.filename || 'unknown file';
  const lineNumber = path.node.loc?.start.line ?? 'unknown line';
  log(`Optimizing Text component in ${filename}:${lineNumber}`);

  // Optimize props
  fixNegativeNumberOfLines({ path, log });
  optimizeStyleTag({ path, file });

  // Add TextNativeComponent import (cached on file) so we only add it once per file
  if (!file.__hasImports) {
    file.__hasImports = {};
  }
  if (!file.__hasImports.NativeText) {
    file.__hasImports.NativeText = addNamed(path, 'NativeText', 'react-native/Libraries/Text/TextNativeComponent');
  }
  const nativeTextIdentifier = file.__hasImports.NativeText;
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

function fixNegativeNumberOfLines({
  path,
  log,
}: {
  path: NodePath<t.JSXOpeningElement>;
  log: (message: string) => void;
}) {
  for (const attribute of path.node.attributes) {
    if (
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: 'numberOfLines' }) &&
      attribute.value &&
      t.isJSXExpressionContainer(attribute.value)
    ) {
      let originalValue: number | undefined;
      if (t.isNumericLiteral(attribute.value.expression)) {
        originalValue = attribute.value.expression.value;
      } else if (
        t.isUnaryExpression(attribute.value.expression) &&
        attribute.value.expression.operator === '-' &&
        t.isNumericLiteral(attribute.value.expression.argument)
      ) {
        originalValue = -attribute.value.expression.argument.value;
      }
      if (originalValue !== undefined && originalValue < 0) {
        log(
          `Warning: 'numberOfLines' in <Text> must be a non-negative number, received: ${originalValue}. The value will be set to 0.`
        );
        attribute.value.expression = t.numericLiteral(0);
      }
    }
  }
}

function optimizeStyleTag({ path, file }: { path: NodePath<t.JSXOpeningElement>; file: HubFile }) {
  let shouldImportFlattenTextStyle = false;
  const nameHint = '_flattenTextStyle';

  for (const [index, attribute] of path.node.attributes.entries()) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
      shouldImportFlattenTextStyle = true;

      if (t.isJSXExpressionContainer(attribute.value) && !t.isJSXEmptyExpression(attribute.value.expression)) {
        path.node.attributes[index] = t.jsxSpreadAttribute(
          t.callExpression(t.identifier(nameHint), [attribute.value.expression])
        );
      }
    }
  }

  if (shouldImportFlattenTextStyle && !file.__hasImports?.flattenTextStyle) {
    if (!file.__hasImports) file.__hasImports = {};
    file.__hasImports.flattenTextStyle = addNamed(path, 'flattenTextStyle', 'react-native-boost', { nameHint });
  }
}

function hasInvalidChildren(path: NodePath<t.JSXOpeningElement>): boolean {
  for (const attribute of path.node.attributes) {
    if (t.isJSXSpreadAttribute(attribute)) return false; // spread attributes are handled in hasBlacklistedProperty

    if (t.isJSXIdentifier(attribute.name) && attribute.value) {
      // For a "children" attribute, optimization is allowed only if it is a string
      if (attribute.name.name === 'children') {
        return isStringNode(path, attribute.value);
      }
      return textBlacklistedProperties.has(attribute.name.name);
    }
  }
  return false;
}
