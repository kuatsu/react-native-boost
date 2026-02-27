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
          optimizer(path, logger, options);
        },
      },
    };
  });
};
