import { declare } from '@babel/helper-plugin-utils';
import { Optimizer } from '../types';

export const generateTestPlugin = (optimizer: Optimizer) => {
  return declare((api) => {
    api.assertVersion(7);

    return {
      name: 'react-native-boost',
      visitor: {
        JSXOpeningElement(path) {
          optimizer(path);
        },
      },
    };
  });
};
