import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { PluginOptions } from './types';
import { log } from './utils/logger';

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const options = (state.opts ?? {}) as PluginOptions;
        const logger = options.verbose ? log : () => {};
        if (options.optimizations?.text !== false) textOptimizer(path, logger);
      },
    },
  };
});
