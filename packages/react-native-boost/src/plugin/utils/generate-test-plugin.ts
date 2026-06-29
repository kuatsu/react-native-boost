import { declare } from '@babel/helper-plugin-utils';
import { Optimizer, PluginOptions, TargetPlatform } from '../types';
import { createLogger } from './logger';
import { textOptimizer } from '../optimizers/text';
import { viewOptimizer } from '../optimizers/view';
import { imageOptimizer } from '../optimizers/image';

export const generateTestPlugin = (optimizer: Optimizer, options: PluginOptions = {}, platform?: TargetPlatform) => {
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
          optimizer(path, logger, options, platform, options.unistyles === true);
        },
      },
    };
  });
};

/**
 * Runs all optimizers per element, exactly as the real plugin does (`Text`, then `View`, then `Image`).
 * Needed for cases that depend on optimizers interacting — notably nested elements, where an outer host
 * rewrite affects how an inner element classifies its ancestors.
 */
export const generateCombinedTestPlugin = (options: PluginOptions = {}, platform?: TargetPlatform) => {
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
          textOptimizer(path, logger, options, platform, unistylesEnabled);
          viewOptimizer(path, logger, options, platform, unistylesEnabled);
          imageOptimizer(path, logger, options, platform, unistylesEnabled);
        },
      },
    };
  });
};
