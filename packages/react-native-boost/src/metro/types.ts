import type { PluginOptions } from '../plugin/types';

export interface MetroTransformerManifest {
  babelTransformerPath: string;
  pluginPath: string;
  pluginOptions: PluginOptions & {
    __reactNativeBoostProjectRoot?: string;
    __reactNativeBoostSnapshot?: string;
  };
  injectionId: string;
}

export interface MetroWorkerManifest {
  transformerPath: string;
  injectionId: string;
}
