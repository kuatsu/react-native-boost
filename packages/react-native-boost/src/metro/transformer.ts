import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { TransformOptions } from '@babel/core';
import type { MetroTransformerManifest } from './types';

const requireFromTransformer = createRequire(import.meta.url);
const moduleFilename = fileURLToPath(import.meta.url);

type BabelTransformerArgs = {
  filename: string;
  options: Record<string, unknown>;
  plugins?: TransformOptions['plugins'];
  src: string;
};

type TransformResult = {
  ast: unknown;
  metadata?: Record<string, unknown>;
};

type BabelTransformer = {
  transform: (arguments_: BabelTransformerArgs) => TransformResult | Promise<TransformResult>;
  getCacheKey?: (options?: Record<string, unknown>) => string;
};

export function createTransformer(manifest: MetroTransformerManifest) {
  const delegate = loadTransformer(manifest.babelTransformerPath);
  const boostPlugin = requireFromTransformer(manifest.pluginPath) as unknown;
  const pluginOptions = {
    ...manifest.pluginOptions,
    __reactNativeBoost: manifest.injectionId,
  };

  return {
    async transform(arguments_: BabelTransformerArgs): Promise<TransformResult> {
      const result = await delegate.transform({
        ...arguments_,
        plugins: [[boostPlugin, pluginOptions], ...(arguments_.plugins ?? [])],
      });
      return validateResult(result);
    },
    getCacheKey(options?: Record<string, unknown>): string {
      const delegateKey = delegate.getCacheKey?.(options) ?? '';
      return createHash('sha256')
        .update(JSON.stringify(manifest))
        .update(delegateKey)
        .update(fs.readFileSync(moduleFilename))
        .update(fs.readFileSync(manifest.pluginPath))
        .digest('hex');
    },
  };

  function validateResult(result: TransformResult): TransformResult {
    const metadata = result.metadata?.reactNativeBoost as { injectionId?: unknown } | undefined;
    if (metadata?.injectionId !== manifest.injectionId) {
      throw new Error('[react-native-boost] The configured Babel transformer did not run the Boost plugin.');
    }
    return result;
  }
}

function loadTransformer(modulePath: string): BabelTransformer {
  const loaded = requireFromTransformer(modulePath) as BabelTransformer | { default?: BabelTransformer };
  const transformer = 'transform' in loaded ? loaded : loaded.default;
  if (!transformer || typeof transformer.transform !== 'function') {
    throw new Error(`[react-native-boost] ${modulePath} is not a Babel transformer.`);
  }
  return transformer;
}
