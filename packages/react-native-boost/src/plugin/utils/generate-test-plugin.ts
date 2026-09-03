import { declare } from '@babel/helper-plugin-utils';
import { BoostOptions, Optimizer, TargetPlatform } from '../types';
import { createLogger } from './logger';

export const generateTestPlugin = (optimizer: Optimizer, options: BoostOptions = {}, platform?: TargetPlatform) => {
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
