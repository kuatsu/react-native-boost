import { declare } from '@babel/helper-plugin-utils';
import { Optimizer, PluginOptions } from '../types';
import { createLogger } from './logger';
import { textOptimizer } from '../optimizers/text';
import { viewOptimizer } from '../optimizers/view';

export const generateTestPlugin = (optimizer: Optimizer, options: PluginOptions = {}) => {
  const logger = createLogger({
    verbose: false,
    silent: true,
  });

  return declare((api) => {
    api.assertVersion(7);

    return {
      name: 'react-native-boost',
      visitor: {
        JSXOpeningElement(path) {
          // Mirror the real plugin's explicit-flag resolution for Unistyles mode (auto-detection is not
          // exercised in fixtures); a fixture opts in with `{ unistyles: true }`.
          optimizer(path, logger, options, undefined, options.unistyles === true);
        },
      },
    };
  });
};

/**
 * Runs both optimizers per element, exactly as the real plugin does (`textOptimizer` then
 * `viewOptimizer`). Needed for cases that depend on the two interacting — notably nested elements, where
 * an outer `View` must be rewritten before an inner element classifies it as an ancestor.
 */
export const generateCombinedTestPlugin = (options: PluginOptions = {}) => {
  const logger = createLogger({
    verbose: false,
    silent: true,
  });

  return declare((api) => {
    api.assertVersion(7);

    const unistylesEnabled = options.unistyles === true;

    return {
      name: 'react-native-boost',
      visitor: {
        JSXOpeningElement(path) {
          textOptimizer(path, logger, options, undefined, unistylesEnabled);
          viewOptimizer(path, logger, options, undefined, unistylesEnabled);
        },
      },
    };
  });
};
