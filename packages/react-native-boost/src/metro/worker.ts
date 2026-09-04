import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { takeAnalysis } from './bridge';
import type { MetroWorkerManifest } from './types';

const requireFromWorker = createRequire(import.meta.url);
const moduleFilename = fileURLToPath(import.meta.url);

type MetroWorker = {
  transform: (
    config: Record<string, unknown>,
    projectRoot: string,
    filename: string,
    data: Buffer,
    options: Record<string, unknown>
  ) => Promise<MetroTransformResult>;
  getCacheKey?: (config: Record<string, unknown>, options?: { projectRoot?: string }) => string;
};

type MetroTransformResult = {
  dependencies: unknown[];
  output: Array<{ data: Record<string, unknown>; type: string }>;
};

export function createWorker(manifest: MetroWorkerManifest): MetroWorker {
  const delegate = loadWorker(manifest.transformerPath);

  return {
    async transform(config, projectRoot, filename, data, options) {
      const result = await delegate.transform(config, projectRoot, filename, data, options);
      const metadata = takeAnalysis(filename);
      if (!metadata) {
        if (/\.[cm]?[jt]sx?$/.test(filename)) {
          throw new Error(
            '[react-native-boost] The configured Metro transform worker did not run the Boost Babel transformer.'
          );
        }
        return result;
      }
      if (metadata.injectionId !== manifest.injectionId) {
        throw new Error('[react-native-boost] Metro worker received analysis from a different Boost configuration.');
      }
      for (const output of result.output) {
        if (output.type.startsWith('js/')) output.data.reactNativeBoost = metadata;
      }
      return result;
    },
    getCacheKey(config, options) {
      return createHash('sha256')
        .update(JSON.stringify(manifest))
        .update(delegate.getCacheKey?.(config, options) ?? '')
        .update(fs.readFileSync(moduleFilename))
        .digest('hex');
    },
  };
}

function loadWorker(modulePath: string): MetroWorker {
  const loaded = requireFromWorker(modulePath) as MetroWorker | { default?: MetroWorker };
  const worker = 'transform' in loaded ? loaded : loaded.default;
  if (!worker || typeof worker.transform !== 'function') {
    throw new Error(`[react-native-boost] ${modulePath} is not a Metro transform worker.`);
  }
  return worker;
}
