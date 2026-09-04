import type { PluginOptions } from '../plugin/types';

export interface MetroTransformerManifest {
  babelTransformerPath: string;
  pluginPath: string;
  pluginOptions: PluginOptions;
  injectionId: string;
}
