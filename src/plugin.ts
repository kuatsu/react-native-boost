import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { PluginOptions } from './types';

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const options = (state.opts ?? {}) as PluginOptions;
        if (options.optimizations?.text !== false) textOptimizer(path);
      },
    },
  };
});
