import { types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import {
  hasBlacklistedProperty,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
  hasComponentAncestor,
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

// Components to skip when checking for indirect Text ancestors
const skipComponents = ['View', 'Fragment', 'ScrollView', 'FlatList'];

export const viewOptimizer: Optimizer = (path, log = () => {}) => {
  if (isIgnoredLine(path)) return;
  if (!isValidJSXComponent(path, 'View')) return;
  if (!isReactNativeImport(path, 'View')) return;
  if (hasBlacklistedProperty(path, viewBlacklistedProperties)) return;
  if (hasComponentAncestor(path, 'Text', skipComponents)) return;

  // Extract the file from the Babel hub
  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const filename = file.opts?.filename || 'unknown file';
  const lineNumber = path.node.loc?.start.line ?? 'unknown line';
  log(`Optimizing View component in ${filename}:${lineNumber}`);

  const parent = path.parent as t.JSXElement;

  // Replace the View component with NativeView
  replaceWithNativeComponent(path, parent, file, 'NativeView');
};
