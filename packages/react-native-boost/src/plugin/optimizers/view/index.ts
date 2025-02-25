import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import {
  hasBlacklistedProperty,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
} from '../../utils/common';

export const viewBlacklistedProperties = new Set([
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
  'disabled',
  'id',
  'nativeID',
  'numberOfLines',
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
  'selectable',
  'selectionColor',
  'suppressHighlighting',
  'style',
]);

export const viewOptimizer: Optimizer = (path, log = () => {}) => {
  if (isIgnoredLine(path)) return;
  if (!isValidJSXComponent(path, 'View')) return;
  if (!isReactNativeImport(path, 'View')) return;
  if (hasBlacklistedProperty(path, viewBlacklistedProperties)) return;
  if (hasTextAncestor(path)) return;

  // Extract the file from the Babel hub and add flags for logging & import caching.
  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const filename = file.opts?.filename || 'unknown file';
  const lineNumber = path.node.loc?.start.line ?? 'unknown line';
  log(`Optimizing View component in ${filename}:${lineNumber}`);

  const parent = path.parent as t.JSXElement;

  // Replace the Text component with NativeText
  replaceWithNativeComponent(path, parent, file, 'NativeView');
};

/**
 * Returns true if any ancestor element is a <Text /> or contains a <Text />.
 * This function handles both direct Text ancestors and custom components that may contain Text.
 * TODO: We can't test across file boundaries within the Babel plugin
 */
function hasTextAncestor(path: NodePath<t.JSXOpeningElement>): boolean {
  // Check for direct Text ancestors (no custom components)
  const directTextAncestor = path.findParent((parentPath) => {
    return t.isJSXElement(parentPath.node) && t.isJSXIdentifier(parentPath.node.openingElement.name, { name: 'Text' });
  });

  if (directTextAncestor) return true;

  // Check for indirect Text ancestors (custom components that contain Text)
  return !!path.findParent((parentPath) => {
    // Only check JSX elements
    if (!t.isJSXElement(parentPath.node)) return false;

    // Get the component name
    const openingElement = parentPath.node.openingElement;
    if (!t.isJSXIdentifier(openingElement.name)) return false;

    const componentName = openingElement.name.name;

    // Skip built-in components and already checked Text component
    if (
      componentName === 'Text' ||
      componentName === 'View' ||
      componentName === 'Fragment' ||
      componentName[0] === componentName[0].toLowerCase()
    ) {
      return false;
    }

    // Try to find the component definition through variable binding
    const binding = parentPath.scope.getBinding(componentName);
    if (!binding) return false;

    // Now check the component definition for Text elements
    if (t.isVariableDeclarator(binding.path.node)) {
      const init = binding.path.node.init;

      // Handle arrow functions or function expressions
      if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
        // Check the function body for Text elements
        return t.isBlockStatement(init.body) ? hasTextInReturnStatement(init.body) : hasTextInExpression(init.body);
      }
    } else if (t.isFunctionDeclaration(binding.path.node)) {
      // Handle function declarations
      return hasTextInReturnStatement(binding.path.node.body);
    }

    return false;
  });
}

/**
 * Check if a block statement contains a return statement with a Text element
 */
function hasTextInReturnStatement(blockStatement: t.BlockStatement): boolean {
  for (const statement of blockStatement.body) {
    if (t.isReturnStatement(statement) && statement.argument && hasTextInExpression(statement.argument)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an expression contains a Text element
 */
function hasTextInExpression(expression: t.Expression): boolean {
  // If directly returning a JSX element
  if (t.isJSXElement(expression)) {
    // Check if it's a Text element
    if (t.isJSXIdentifier(expression.openingElement.name, { name: 'Text' })) {
      return true;
    }

    // Check if any children are Text elements
    for (const child of expression.children) {
      if (t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'Text' })) {
        return true;
      }
    }
  }

  return false;
}
