import { declare } from '@babel/helper-plugin-utils';
import { Optimizer, PluginOptions } from '../types';

export const generateTestPlugin = (optimizer: Optimizer, options: PluginOptions = {}) => {
  return declare((api) => {
    api.assertVersion(7);

    return {
      name: 'react-native-boost',
      visitor: {
        JSXOpeningElement(path) {
          optimizer(path, undefined, options);
        },
      },
    };
  });
};
