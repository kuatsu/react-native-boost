import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { addFileImportHint, hasBlacklistedProperty, shouldIgnoreOptimization } from '../../utils/common';

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
  // Ensure we're processing a JSX element identifier.
  if (!t.isJSXIdentifier(path.node.name)) return;

  const parent = path.parent;
  if (!t.isJSXElement(parent)) return;

  const elementName = path.node.name.name;
  if (elementName !== 'View') return;

  // Respect comments that disable optimization.
  if (shouldIgnoreOptimization(path)) return;

  // Ensure the View element comes from react-native.
  const binding = path.scope.getBinding(elementName);
  if (!binding) return;
  if (binding.kind === 'module') {
    const parentNode = binding.path.parent;
    if (!t.isImportDeclaration(parentNode) || parentNode.source.value !== 'react-native') {
      return;
    }
  }

  // Bail if any blacklisted props are present.
  if (hasBlacklistedProperty(path, viewBlacklistedProperties)) return;

  // Bail if a <TextAncestor /> component exists as an ancestor.
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

  // Add ViewNativeComponent import (cached on the file) to prevent duplicate imports.
  const viewNativeIdentifier = addFileImportHint({
    file,
    path,
    importName: 'NativeView',
    moduleName: 'react-native-boost',
    importType: 'named',
    nameHint: 'NativeView',
  });

  // Replace the component with its native counterpart.
  path.node.name.name = viewNativeIdentifier.name;

  // If the element is not self-closing, update the closing element as well.
  if (
    !path.node.selfClosing &&
    parent.closingElement &&
    t.isJSXIdentifier(parent.closingElement.name) &&
    parent.closingElement.name.name === 'View'
  ) {
    parent.closingElement.name.name = viewNativeIdentifier.name;
  }
};

/**
 * Returns true if any ancestor element is a <Text />.
 * TODO: This is dangerous as we can't resolve custom components and check if they have a <Text /> ancestor in the tree
 */
function hasTextAncestor(path: NodePath<t.JSXOpeningElement>): boolean {
  return !!path.findParent((parentPath) => {
    return t.isJSXElement(parentPath.node) && t.isJSXIdentifier(parentPath.node.openingElement.name, { name: 'Text' });
  });
}
