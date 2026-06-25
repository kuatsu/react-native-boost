import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { imageOptimizer } from './optimizers/image';
import { PluginLogger, PluginOptions } from './types';
import { createLogger } from './utils/logger';
import { viewOptimizer } from './optimizers/view';
import { isIgnoredFile } from './utils/common';
import { isUnistylesInstalled } from './utils/unistyles';

export type { PluginOptimizationOptions, PluginOptions } from './types';

type PluginState = {
  opts?: PluginOptions;
  __reactNativeBoostLogger?: PluginLogger;
};

export default declare((api, rawOptions, dirname?: string) => {
  api.assertVersion(7);

  const options = (rawOptions ?? {}) as PluginOptions;

  // Target platform, resolved at build time. Metro sets this on the Babel caller per platform bundle,
  // letting optimizers inline platform-specific defaults instead of deferring them to the runtime.
  const platform = api.caller((caller) => (caller as { platform?: string } | undefined)?.platform);

  // Resolve "Unistyles mode" once per plugin instance. An explicit `unistyles` flag always wins;
  // otherwise auto-detect an installed `react-native-unistyles` and, when found, enable the mode but
  // hint to set the flag explicitly — a detected package does not prove its Babel plugin is active.
  const autoDetectedUnistyles = options.unistyles === undefined && isUnistylesInstalled(dirname);
  const unistylesEnabled = options.unistyles === true || autoDetectedUnistyles;

  if (autoDetectedUnistyles) {
    createLogger({ verbose: options.verbose === true, silent: options.silent === true }).warning({
      message:
        'react-native-unistyles was detected, so Unistyles mode was enabled automatically. Set ' +
        '`unistyles: true` in the react-native-boost plugin options to make this explicit, or ' +
        '`unistyles: false` to opt out.',
    });
  }

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const pluginState = state as PluginState;
        const logger = getOrCreateLogger(pluginState, options);

        if (isIgnoredFile(path, options.ignores ?? [])) return;
        if (options.optimizations?.text !== false) textOptimizer(path, logger, options, platform, unistylesEnabled);
        if (options.optimizations?.view !== false) viewOptimizer(path, logger, options, platform, unistylesEnabled);
        if (options.optimizations?.image !== false) imageOptimizer(path, logger, options, platform, unistylesEnabled);
      },
    },
  };
});

function getOrCreateLogger(state: PluginState, options: PluginOptions): PluginLogger {
  if (state.__reactNativeBoostLogger) {
    return state.__reactNativeBoostLogger;
  }

  state.__reactNativeBoostLogger = createLogger({
    verbose: options.verbose === true,
    silent: options.silent === true,
  });

  return state.__reactNativeBoostLogger;
}
