import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';
import { PluginOptions } from './types';
import { log } from './utils/logger';
import { viewOptimizer } from './optimizers/view';
import { isIgnoredFile } from './utils/common';

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'react-native-boost',
    visitor: {
      JSXOpeningElement(path, state) {
        const options = (state.opts ?? {}) as PluginOptions;
        const logger = options.verbose ? log : () => {};
        if (isIgnoredFile(path, options.ignores ?? [])) return;
        if (options.optimizations?.text !== false) textOptimizer(path, logger);
        if (options.optimizations?.view !== false) viewOptimizer(path, logger);
      },
    },
  };
});
