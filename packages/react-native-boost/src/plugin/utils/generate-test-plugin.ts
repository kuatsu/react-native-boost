import { declare } from '@babel/helper-plugin-utils';
import { Optimizer, PluginOptions } from '../types';
import { createLogger } from './logger';

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
