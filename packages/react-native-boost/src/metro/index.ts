import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginOptions } from '../plugin/types';
import { validatePluginOptions } from '../plugin/utils/options';
import { resolveReactNativeTarget, type ResolvedReactNativeTarget } from '../plugin/utils/react-native-target';
import type { MetroTransformerManifest } from './types';

export type { PluginOptions } from '../plugin/types';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const transformerDirectory = path.join(os.tmpdir(), 'react-native-boost');

type MetroConfig = {
  projectRoot?: string;
  transformer?: {
    babelTransformerPath?: string;
  };
  resolver?: {
    extraNodeModules?: Record<string, string>;
    resolveRequest?: unknown;
  };
};

export function withBoostConfig<T extends MetroConfig>(config: T, rawOptions: PluginOptions = {}): T {
  const options = validatePluginOptions(rawOptions);
  const projectRoot = path.resolve(config.projectRoot ?? process.cwd());
  const delegateRequest = config.transformer?.babelTransformerPath ?? 'metro-babel-transformer';
  if (path.isAbsolute(delegateRequest) && path.dirname(delegateRequest) === transformerDirectory) {
    throw new Error('[react-native-boost] withBoostConfig was applied more than once.');
  }
  const delegatePath = resolveBabelTransformer(delegateRequest, projectRoot);
  const mappedReactNative = config.resolver?.extraNodeModules?.['react-native'];
  const configuredPackageJson =
    options.target?.reactNative?.packageJson ??
    (mappedReactNative ? path.join(mappedReactNative, 'package.json') : undefined);
  const targetResolution = resolveReactNativeTarget(
    configuredPackageJson ? { packageJson: configuredPackageJson } : undefined,
    [path.join(projectRoot, 'package.json')]
  );
  if (configuredPackageJson && !targetResolution.target) {
    throw new Error(`[react-native-boost] Cannot read React Native package at ${configuredPackageJson}.`);
  }
  const pluginOptions = createPluginOptions(options, targetResolution.target);
  const injectionId = hash(
    `${projectRoot}:${JSON.stringify(pluginOptions)}:${targetResolution.target?.fingerprint ?? 'unknown'}`
  );
  const manifest: MetroTransformerManifest = {
    babelTransformerPath: delegatePath,
    pluginPath: path.resolve(moduleDirectory, '../plugin/index.js'),
    pluginOptions,
    injectionId,
  };
  const transformerPath = writeTransformer(manifest);

  if (config.resolver?.resolveRequest && !configuredPackageJson && options.logLevel !== 'silent') {
    console.warn(
      '[react-native-boost] A custom Metro resolver is active. Set target.reactNative.packageJson if it resolves React Native elsewhere.'
    );
  }

  if (!targetResolution.target && options.logLevel !== 'silent') {
    console.warn(
      '[react-native-boost] React Native could not be detected. Version-dependent optimizations will be skipped.'
    );
  }

  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerPath,
    },
  };
}

function createPluginOptions(options: PluginOptions, installedTarget?: ResolvedReactNativeTarget): PluginOptions {
  const { target, ...pluginOptions } = options;
  void target;
  if (!installedTarget) return pluginOptions;
  return {
    ...pluginOptions,
    target: { reactNative: { packageJson: installedTarget.packageJson } },
  };
}

// Metro accepts a transformer path, so a deterministic wrapper carries this project's options into its workers.
function writeTransformer(manifest: MetroTransformerManifest): string {
  const transformerModule = path.resolve(moduleDirectory, 'transformer.js');
  const source = `module.exports = require(${JSON.stringify(transformerModule)}).createTransformer(${JSON.stringify(manifest)});\n`;
  const filename = path.join(transformerDirectory, `${hash(source)}.cjs`);
  fs.mkdirSync(transformerDirectory, { recursive: true });
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, source);
  return filename;
}

function resolveBabelTransformer(request: string, projectRoot: string): string {
  try {
    return createRequire(path.join(projectRoot, 'package.json')).resolve(request);
  } catch (error) {
    throw new Error(
      `[react-native-boost] Cannot resolve Babel transformer ${JSON.stringify(request)} from ${projectRoot}. Set transformer.babelTransformerPath with require.resolve(...).`,
      { cause: error }
    );
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
