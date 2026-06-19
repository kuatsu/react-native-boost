import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { PluginLogger, PluginOptions } from './types';
import { createLogger } from './utils/logger';
import { viewOptimizer } from './optimizers/view';
import { isIgnoredFile } from './utils/common';

export type { PluginOptimizationOptions, PluginOptions } from './types';

type PluginState = {
  opts?: PluginOptions;
  __reactNativeBoostLogger?: PluginLogger;
};

export default declare((api) => {
  api.assertVersion(7);

  // Target platform, resolved at build time. Metro sets this on the Babel caller per platform bundle,
  // letting optimizers inline platform-specific defaults instead of deferring them to the runtime.
  const platform = api.caller((caller) => (caller as { platform?: string } | undefined)?.platform);

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const pluginState = state as PluginState;
        const options = (pluginState.opts ?? {}) as PluginOptions;
        const logger = getOrCreateLogger(pluginState, options);

        if (isIgnoredFile(path, options.ignores ?? [])) return;
        if (options.optimizations?.text !== false) textOptimizer(path, logger, options, platform);
        if (options.optimizations?.view !== false) viewOptimizer(path, logger, options);
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
