import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import {
  addFileImportHint,
  buildPropertiesFromAttributes,
  hasAccessibilityProperty,
  hasBlacklistedProperty,
  shouldIgnoreOptimization,
} from '../../utils/common';

export const textBlacklistedProperties = new Set([
  'allowFontScaling',
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

  // Process style and accessibility props
  const originalAttributes = [...path.node.attributes];
  let styleAttribute, styleExpr;
  for (const attribute of originalAttributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
      styleAttribute = attribute;
      break;
    }
  }
  if (
    styleAttribute &&
    styleAttribute.value &&
    t.isJSXExpressionContainer(styleAttribute.value) &&
    !t.isJSXEmptyExpression(styleAttribute.value.expression)
  ) {
    styleExpr = styleAttribute.value.expression;
  }
  const hasA11y = hasAccessibilityProperty(path, originalAttributes);

  if (styleExpr && hasA11y) {
    // When both style and accessibility properties exist, we split them into two separate spread attributes

    // Filter out the style attribute for accessibility props
    const accessibilityAttributes = originalAttributes.filter((attribute) => {
      if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
        return false;
      }
      return true;
    });

    // Set up the accessibility import if needed
    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'normalizeAccessibilityProps',
      path,
      importName: 'normalizeAccessibilityProps',
      moduleName: 'react-native-boost',
    });
    const accessibilityObject = buildPropertiesFromAttributes(accessibilityAttributes);
    const accessibilityExpr = t.callExpression(t.identifier(normalizeIdentifier.name), [accessibilityObject]);

    // Set up the style import if needed.
    const flattenIdentifier = addFileImportHint({
      file,
      nameHint: 'flattenTextStyle',
      path,
      importName: 'flattenTextStyle',
      moduleName: 'react-native-boost',
    });
    const flattenedStyleExpr = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);

    // Use two separate JSX spread attributes so that accessibility and style props remain distinct.
    path.node.attributes = [t.jsxSpreadAttribute(accessibilityExpr), t.jsxSpreadAttribute(flattenedStyleExpr)];
  } else if (styleExpr) {
    // Only style attribute is present.
    const flattenIdentifier = addFileImportHint({
      file,
      nameHint: 'flattenTextStyle',
      path,
      importName: 'flattenTextStyle',
      moduleName: 'react-native-boost',
    });
    const flattened = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);
    path.node.attributes = [t.jsxSpreadAttribute(flattened)];
  } else if (hasA11y) {
    // Only accessibility properties are present.
    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'normalizeAccessibilityProps',
      path,
      importName: 'normalizeAccessibilityProps',
      moduleName: 'react-native-boost',
    });
    const propsObject = buildPropertiesFromAttributes(originalAttributes);
    const normalized = t.callExpression(t.identifier(normalizeIdentifier.name), [propsObject]);
    path.node.attributes = [t.jsxSpreadAttribute(normalized)];
  }

  // Add TextNativeComponent import (cached on file) so we only add it once per file.
  const nativeTextIdentifier = addFileImportHint({
    file,
    nameHint: 'NativeText',
    path,
    importName: 'NativeText',
    moduleName: 'react-native-boost',
  });
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

function hasInvalidChildren(path: NodePath<t.JSXOpeningElement>): boolean {
  for (const attribute of path.node.attributes) {
    if (t.isJSXSpreadAttribute(attribute)) continue; // Spread attributes are handled in hasBlacklistedProperty

    if (t.isJSXIdentifier(attribute.name) && attribute.value) {
      // For a "children" attribute, optimization is allowed only if it is a string
      if (attribute.name.name === 'children') {
        if (!isStringNode(path, attribute.value)) {
          return true;
        }
      } else if (textBlacklistedProperties.has(attribute.name.name)) {
        return true;
      }
    }
  }
  return false;
}
