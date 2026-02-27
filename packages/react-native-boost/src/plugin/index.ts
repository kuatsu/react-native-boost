import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { PluginLogger, PluginOptions } from './types';
import { createLogger } from './utils/logger';
import { viewOptimizer } from './optimizers/view';
import { isIgnoredFile } from './utils/common';

type PluginState = {
  opts?: PluginOptions;
  __reactNativeBoostLogger?: PluginLogger;
};

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const pluginState = state as PluginState;
        const options = (pluginState.opts ?? {}) as PluginOptions;
        const logger = getOrCreateLogger(pluginState, options);

        if (isIgnoredFile(path, options.ignores ?? [])) return;
        if (options.optimizations?.text !== false) textOptimizer(path, logger);
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
