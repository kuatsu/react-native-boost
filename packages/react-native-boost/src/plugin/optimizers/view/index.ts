import { types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  hasBlacklistedProperty,
  isForcedLine,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
  ancestorBailoutChecks,
} from '../../utils/common';

export const viewBlacklistedProperties = new Set([
  // The `View` wrapper translates these into native props (e.g. `aria-*` → `accessibility*`,
  // `tabIndex` → `focusable`). The native host does not understand them, so passing them through
  // would silently drop them. TODO: process these at runtime instead of bailing.
  'accessible',
  'accessibilityLabel',
  'accessibilityState',
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'aria-selected',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'id',
  'nativeID',
  'tabIndex',
]);

export const viewOptimizer: Optimizer = (path, logger, options) => {
  if (!isValidJSXComponent(path, 'View')) return;
  if (!isReactNativeImport(path, 'View')) return;

  const forced = isForcedLine(path);

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'contains blacklisted props',
      shouldBail: () => hasBlacklistedProperty(path, viewBlacklistedProperties),
    },
    ...ancestorBailoutChecks(path, options?.dangerouslyOptimizeViewWithUnknownAncestors === true),
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
