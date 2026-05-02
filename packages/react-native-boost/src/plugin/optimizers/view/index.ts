import { types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  hasBlacklistedProperty,
  getUnistylesStyleStatus,
  isForcedLine,
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

const viewBlacklistedPropertiesWithoutStyle = new Set(
  [...viewBlacklistedProperties].filter((property) => property !== 'style')
);

export const viewOptimizer: Optimizer = (path, logger, options) => {
  if (!isValidJSXComponent(path, 'View')) return;
  if (!isReactNativeImport(path, 'View')) return;
  const unistylesStyleStatus = getUnistylesStyleStatus(path);
  const usesUnistylesStyle = unistylesStyleStatus === 'static';

  if (unistylesStyleStatus === 'dynamic') {
    logger.skipped({ component: 'View', path, reason: 'contains dynamic Unistyles styles' });
    return;
  }

  let ancestorClassification: ViewAncestorClassification | undefined;
  const getAncestorClassification = () => {
    if (!ancestorClassification) {
      ancestorClassification = getViewAncestorClassification(path);
    }

    return ancestorClassification;
  };

  const forced = isForcedLine(path);

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'contains blacklisted props',
      shouldBail: () =>
        hasBlacklistedProperty(
          path,
          usesUnistylesStyle ? viewBlacklistedPropertiesWithoutStyle : viewBlacklistedProperties
        ),
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
  ];

  if (forced) {
    const overriddenReason = getFirstBailoutReason(overridableChecks);

    if (overriddenReason) {
      logger.forced({ component: 'View', path, reason: overriddenReason });
    }
  } else {
    const skipReason = getFirstBailoutReason([
      {
        reason: 'line is marked with @boost-ignore',
        shouldBail: () => isIgnoredLine(path),
      },
      ...overridableChecks,
    ]);

    if (skipReason) {
      logger.skipped({ component: 'View', path, reason: skipReason });
      return;
    }
  }

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

  replaceWithNativeComponent(path, parent, file, 'NativeView');
};
