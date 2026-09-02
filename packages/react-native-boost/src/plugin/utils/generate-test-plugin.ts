import { declare } from '@babel/helper-plugin-utils';
import { Optimizer, PluginOptions, TargetPlatform } from '../types';
import { createLogger } from './logger';

export const generateTestPlugin = (optimizer: Optimizer, options: PluginOptions = {}, platform?: TargetPlatform) => {
  const logger = createLogger('silent');

  return declare((api) => {
    api.assertVersion(7);

    return {
      name: 'react-native-boost',
      visitor: {
        JSXOpeningElement(path) {
          // Auto-detection is not exercised in fixtures.
          optimizer(path, logger, options, platform, options.integrations?.unistyles === 'on');
        },
      },
    };
  });
};
