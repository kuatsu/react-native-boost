import { declare } from '@babel/helper-plugin-utils';
import { textOptimizer } from './optimizers/text';

export default declare((api) => {
  api.assertVersion(7);

  return {
    name: 'react-native-boost/text',
    visitor: {
      JSXOpeningElement(path) {
        textOptimizer(path);
      },
    },
  };
});
