import type { BabelPluginOptions } from '../plugin/types';

export interface MetroTransformerManifest {
  babelTransformerPath: string;
  pluginPath: string;
  pluginOptions: BabelPluginOptions;
  injectionId: string;
}
