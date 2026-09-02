import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { imageOptimizer } from './optimizers/image';
import type { PluginOptions, TargetPlatform } from './types';
import { createLogger } from './utils/logger';
import { viewOptimizer } from './optimizers/view';
import { isIgnoredFile } from './utils/common';
import { isUnistylesInstalled } from './utils/unistyles';
import { activityIndicatorOptimizer } from './optimizers/activity-indicator';
import { validatePluginOptions } from './utils/options';

export type {
  IntegrationState,
  LogLevel,
  OptimizationSetting,
  OptimizationState,
  PluginAssumptions,
  PluginIntegrationOptions,
  PluginOptimizationOptions,
  PluginOptions,
} from './types';

export default declare((api, rawOptions, dirname?: string) => {
  api.assertVersion(7);

  const options = validatePluginOptions(rawOptions ?? {});
  const logger = createLogger(options.logLevel ?? 'info');

  // Target platform, resolved at build time. Metro sets this on the Babel caller per platform bundle,
  // letting optimizers inline platform-specific defaults instead of deferring them to the runtime.
  const platform = api.caller((caller) =>
    normalizeTargetPlatform((caller as { platform?: string } | undefined)?.platform)
  );

  // A detected package does not prove its Babel plugin is active, so auto-detection still asks users
  // to configure the integration explicitly.
  const unistylesMode = options.integrations?.unistyles ?? 'auto';
  const autoDetectedUnistyles = unistylesMode === 'auto' && isUnistylesInstalled(dirname);
  const unistylesEnabled = unistylesMode === 'on' || autoDetectedUnistyles;

  if (autoDetectedUnistyles) {
    logger.warning({
      message:
        'react-native-unistyles was detected, so Unistyles mode was enabled automatically. Set ' +
        "`integrations: { unistyles: 'on' }` in the react-native-boost plugin options to make this explicit, or " +
        "`integrations: { unistyles: 'off' }` to opt out.",
    });
  }

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path) {
        if (isIgnoredFile(path, options.ignores ?? [])) return;
        if (isOptimizationEnabled(options, 'native-text'))
          textOptimizer(path, logger, options, platform, unistylesEnabled);
        if (isOptimizationEnabled(options, 'native-view'))
          viewOptimizer(path, logger, options, platform, unistylesEnabled);
        if (isOptimizationEnabled(options, 'native-image'))
          imageOptimizer(path, logger, options, platform, unistylesEnabled);
        if (isOptimizationEnabled(options, 'native-activity-indicator'))
          activityIndicatorOptimizer(path, logger, options, platform, unistylesEnabled);
      },
    },
  };
});

function isOptimizationEnabled(
  options: PluginOptions,
  name: keyof NonNullable<PluginOptions['optimizations']>
): boolean {
  const setting = options.optimizations?.[name];
  return (Array.isArray(setting) ? setting[0] : setting) !== 'off';
}

function normalizeTargetPlatform(platform?: string): TargetPlatform | undefined {
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : undefined;
}
