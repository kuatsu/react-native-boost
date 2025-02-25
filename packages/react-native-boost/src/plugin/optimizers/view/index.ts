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
 * Returns true if any ancestor element is a <Text />.
 * TODO: This is dangerous as we can't resolve custom components and check if they have a <Text /> ancestor in the tree
 */
function hasTextAncestor(path: NodePath<t.JSXOpeningElement>): boolean {
  return !!path.findParent((parentPath) => {
    return t.isJSXElement(parentPath.node) && t.isJSXIdentifier(parentPath.node.openingElement.name, { name: 'Text' });
  });
}
