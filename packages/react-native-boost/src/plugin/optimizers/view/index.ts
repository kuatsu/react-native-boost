import { types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { getFirstBailoutReason } from '../../utils/helpers';
import {
  hasBlacklistedProperty,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
  getViewAncestorClassification,
  ViewAncestorClassification,
} from '../../utils/common';

export const viewBlacklistedProperties = new Set([
  // TODO: process a11y props at runtime
  'accessible',
  'accessibilityLabel',
  'accessibilityState',
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-label',
  'aria-selected',
  'id',
  'nativeID',
  'style', // TODO: process style at runtime
]);

export const viewOptimizer: Optimizer = (path, logger, options) => {
  if (!isValidJSXComponent(path, 'View')) return;

  let ancestorClassification: ViewAncestorClassification | undefined;
  const getAncestorClassification = () => {
    if (!ancestorClassification) {
      ancestorClassification = getViewAncestorClassification(path);
    }

    return ancestorClassification;
  };

  const skipReason = getFirstBailoutReason([
    {
      reason: 'line is marked with @boost-ignore',
      shouldBail: () => isIgnoredLine(path),
    },
    {
      reason: 'View is not imported from react-native',
      shouldBail: () => !isReactNativeImport(path, 'View'),
    },
    {
      reason: 'contains blacklisted props',
      shouldBail: () => hasBlacklistedProperty(path, viewBlacklistedProperties),
    },
    {
      reason: 'has Text ancestor',
      shouldBail: () => getAncestorClassification() === 'text',
    },
    {
      reason: 'has unresolved ancestor and dangerous optimization is disabled',
      shouldBail: () =>
        getAncestorClassification() === 'unknown' && options?.dangerouslyOptimizeViewWithUnknownAncestors !== true,
    },
  ]);

  if (skipReason) {
    logger.skipped({
      component: 'View',
      path,
      reason: skipReason,
    });

    return;
  }

  // Extract the file from the Babel hub
  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  logger.optimized({
    component: 'View',
    path,
  });

  const parent = path.parent as t.JSXElement;

  // Replace the View component with NativeView
  replaceWithNativeComponent(path, parent, file, 'NativeView');
};
