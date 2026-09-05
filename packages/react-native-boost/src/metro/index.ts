import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PluginOptions } from '../plugin/types';
import { validatePluginOptions } from '../plugin/utils/options';
import { resolveReactNativeTarget, type ResolvedReactNativeTarget } from '../plugin/utils/react-native-target';
import { installMetroGraphPatch } from './graph';
import type { MetroTransformerManifest, MetroWorkerManifest } from './types';

export type { PluginOptions } from '../plugin/types';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const requireFromMetro = createRequire(import.meta.url);
const transformerDirectory = path.join(os.tmpdir(), 'react-native-boost');
const supportedMetroMinors = new Set([83, 84, 87]);

type CacheStore = {
  name?: string;
  get: (key: Buffer) => unknown;
  set: (key: Buffer, value: unknown) => unknown;
  clear?: () => unknown;
};
type CacheStores = readonly CacheStore[] | ((metroCache: unknown) => readonly CacheStore[]);
type MetroConfig = {
  projectRoot?: string;
  transformerPath?: string;
  cacheStores?: unknown;
  transformer?: {
    babelTransformerPath?: string;
    uniwind?: unknown;
  };
  resolver?: {
    extraNodeModules?: Record<string, string>;
    resolveRequest?: unknown;
  };
};

type MetroIntegration = {
  graphPath: string;
  transformerPath: string;
  version: string;
};

export function withBoostConfig<T extends MetroConfig>(config: T, rawOptions: PluginOptions = {}): T {
  let options = validatePluginOptions(rawOptions);
  const projectRoot = path.resolve(config.projectRoot ?? process.cwd());
  const uniwindEnabled =
    options.integrations?.uniwind === 'on' ||
    (options.integrations?.uniwind !== 'off' && config.transformer?.uniwind !== undefined);
  if (uniwindEnabled && config.transformer?.uniwind === undefined) {
    throw new Error('[react-native-boost] Apply withBoostConfig after withUniwindConfig.');
  }
  if (uniwindEnabled || options.integrations?.uniwind !== undefined) {
    options = { ...options, integrations: { ...options.integrations, uniwind: uniwindEnabled ? 'on' : 'off' } };
  }
  const delegateRequest = config.transformer?.babelTransformerPath ?? 'metro-babel-transformer';
  if (
    (path.isAbsolute(delegateRequest) && path.dirname(delegateRequest) === transformerDirectory) ||
    (config.transformerPath && path.dirname(config.transformerPath) === transformerDirectory)
  ) {
    throw new Error('[react-native-boost] withBoostConfig was applied more than once.');
  }
  const delegatePath = resolveModule(delegateRequest, projectRoot, 'Babel transformer');
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

  if (uniwindEnabled) {
    const uniwindRoot = path.dirname(resolveModule('uniwind/package.json', projectRoot, 'Uniwind'));
    options = {
      ...options,
      ignores: [...(options.ignores ?? []), `${uniwindRoot}/**`, `${path.resolve(moduleDirectory, '../runtime')}/**`],
    };
  }
  const resolver = uniwindEnabled
    ? createUniwindResolver(config, projectRoot, targetResolution.target)
    : config.resolver;

  const requestedCrossFileResolution = options.crossFileAncestorResolution !== false;
  const metro = requestedCrossFileResolution
    ? resolveMetroIntegration(config.transformerPath, delegatePath, projectRoot)
    : undefined;
  let crossFileResolution = Boolean(metro && isSupportedMetro(metro.version));
  if (requestedCrossFileResolution && !crossFileResolution && options.logLevel !== 'silent') {
    console.warn(
      `[react-native-boost] Cross-file ancestor resolution is disabled because ${metro ? `Metro ${metro.version} is unsupported` : 'Metro could not be resolved'}.`
    );
  }

  let pluginOptions: MetroTransformerManifest['pluginOptions'] = createPluginOptions(options, targetResolution.target);
  let injectionId = createInjectionId(projectRoot, pluginOptions, targetResolution.target, crossFileResolution);
  const snapshotPath = path.join(transformerDirectory, `${injectionId}.json`);

  if (crossFileResolution) {
    try {
      initializeSnapshot(snapshotPath);
      installMetroGraphPatch(metro!.graphPath, { injectionId, snapshotPath });
      pluginOptions = {
        ...pluginOptions,
        __reactNativeBoostProjectRoot: projectRoot,
        __reactNativeBoostSnapshot: snapshotPath,
      };
    } catch (error) {
      crossFileResolution = false;
      pluginOptions = createPluginOptions(options, targetResolution.target);
      injectionId = createInjectionId(projectRoot, pluginOptions, targetResolution.target, false);
      if (options.logLevel !== 'silent') {
        console.warn(`[react-native-boost] Cross-file ancestor resolution is disabled: ${String(error)}`);
      }
    }
  }

  const manifest: MetroTransformerManifest = {
    babelTransformerPath: delegatePath,
    pluginPath: path.resolve(moduleDirectory, '../plugin/index.js'),
    pluginOptions,
    injectionId,
  };
  const babelTransformerPath = writeTransformer(manifest);

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
    resolver,
    ...(crossFileResolution && metro
      ? {
          cacheStores: wrapCacheStores(config.cacheStores as CacheStores | undefined, injectionId),
          transformerPath: writeWorker({ transformerPath: metro.transformerPath, injectionId }),
        }
      : {}),
    transformer: {
      ...config.transformer,
      babelTransformerPath,
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

function createInjectionId(
  projectRoot: string,
  options: PluginOptions,
  target: ResolvedReactNativeTarget | undefined,
  crossFileResolution: boolean
): string {
  return hash(`${projectRoot}:${JSON.stringify(options)}:${target?.fingerprint ?? 'unknown'}:${crossFileResolution}`);
}

function writeTransformer(manifest: MetroTransformerManifest): string {
  const transformerModule = path.resolve(moduleDirectory, 'transformer.js');
  const source = `module.exports = require(${JSON.stringify(transformerModule)}).createTransformer(${JSON.stringify(manifest)});\n`;
  return writeWrapper(source);
}

function writeWorker(manifest: MetroWorkerManifest): string {
  const workerModule = path.resolve(moduleDirectory, 'worker.js');
  const source = `module.exports = require(${JSON.stringify(workerModule)}).createWorker(${JSON.stringify(manifest)});\n`;
  return writeWrapper(source);
}

function writeWrapper(source: string): string {
  const filename = path.join(transformerDirectory, `${hash(source)}.cjs`);
  fs.mkdirSync(transformerDirectory, { recursive: true });
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, source);
  return filename;
}

function resolveModule(request: string, projectRoot: string, label: string): string {
  try {
    return createRequire(path.join(projectRoot, 'package.json')).resolve(request);
  } catch (error) {
    throw new Error(
      `[react-native-boost] Cannot resolve ${label} ${JSON.stringify(request)} from ${projectRoot}. Set transformer.babelTransformerPath with require.resolve(...).`,
      { cause: error }
    );
  }
}

function resolveMetroIntegration(
  configuredTransformerPath: string | undefined,
  babelTransformerPath: string,
  projectRoot: string
): MetroIntegration | undefined {
  const babelVersion = findPackage(babelTransformerPath, 'metro-babel-transformer')?.version;
  const loadedMetro = findLoadedMetro(babelVersion);
  if (loadedMetro) {
    try {
      const transformerRequest = configuredTransformerPath ?? 'metro-transform-worker';
      const transformerPath = path.isAbsolute(transformerRequest)
        ? transformerRequest
        : resolveFrom([path.join(projectRoot, 'package.json'), loadedMetro.packageJson], transformerRequest);
      return { graphPath: loadedMetro.graphPath, transformerPath, version: loadedMetro.version };
    } catch {}
  }

  for (const origin of [babelTransformerPath, path.join(projectRoot, 'package.json')]) {
    try {
      const metroRequire = createRequire(origin);
      const transformerPath = configuredTransformerPath
        ? path.isAbsolute(configuredTransformerPath)
          ? configuredTransformerPath
          : metroRequire.resolve(configuredTransformerPath)
        : metroRequire.resolve('metro-transform-worker');
      if (babelVersion && findPackage(transformerPath, 'metro-transform-worker')?.version !== babelVersion) continue;
      const packageJsonPath = metroRequire.resolve('metro/package.json');
      const version = (JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version: string }).version;
      if (babelVersion && version !== babelVersion) continue;
      return {
        graphPath: metroRequire.resolve('metro/private/DeltaBundler/Graph'),
        transformerPath,
        version,
      };
    } catch {}
  }
}

function resolveFrom(origins: string[], request: string): string {
  for (const origin of origins) {
    try {
      return createRequire(origin).resolve(request);
    } catch {}
  }
  throw new Error(`Cannot resolve ${request}.`);
}

function findLoadedMetro(
  expectedVersion: string | undefined
): { graphPath: string; packageJson: string; version: string } | undefined {
  for (const filename of Object.keys(requireFromMetro.cache)) {
    if (!filename.endsWith(`${path.sep}metro${path.sep}src${path.sep}DeltaBundler${path.sep}Graph.js`)) continue;
    const metroPackage = findPackage(filename, 'metro');
    if (!metroPackage || (expectedVersion && metroPackage.version !== expectedVersion)) continue;
    return { graphPath: filename, packageJson: metroPackage.packageJson, version: metroPackage.version };
  }
}

function findPackage(filename: string, name: string): { packageJson: string; version: string } | undefined {
  let directory = path.dirname(filename);
  while (directory !== path.dirname(directory)) {
    const packageJson = path.join(directory, 'package.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as { name?: string; version?: string };
      if (manifest.name === name && manifest.version) return { packageJson, version: manifest.version };
    } catch {}
    directory = path.dirname(directory);
  }
}

function isSupportedMetro(version: string): boolean {
  const match = /^0\.(\d+)\./.exec(version);
  return Boolean(match && supportedMetroMinors.has(Number(match[1])));
}

function initializeSnapshot(snapshotPath: string): void {
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({ version: 1, revision: 0, platforms: {} }));
}

function wrapCacheStores(stores: CacheStores | undefined, injectionId: string): CacheStores {
  if (typeof stores === 'function') return (metroCache) => stores(metroCache).map((store) => wrap(store));
  return (stores ?? []).map((store) => wrap(store));

  function wrap(store: CacheStore): CacheStore {
    return {
      name: store.name,
      get: (key) => store.get.call(store, key),
      set: (key, value) => (hasCrossFileAnalysis(value, injectionId) ? undefined : store.set.call(store, key, value)),
      ...(store.clear ? { clear: () => store.clear!.call(store) } : {}),
    };
  }
}

function hasCrossFileAnalysis(value: unknown, injectionId: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const output = (value as { output?: Array<{ data?: { reactNativeBoost?: unknown } }> }).output;
  return Boolean(
    output?.some(({ data }) => {
      const metadata = data?.reactNativeBoost as
        | { injectionId?: unknown; analysis?: { references?: unknown[]; spreadReferences?: unknown[] } }
        | undefined;
      return (
        metadata?.injectionId === injectionId &&
        Boolean(metadata.analysis?.references?.length || metadata.analysis?.spreadReferences?.length)
      );
    })
  );
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createUniwindResolver(config: MetroConfig, projectRoot: string, target?: ResolvedReactNativeTarget) {
  const packageJson = resolveModule('uniwind/package.json', projectRoot, 'Uniwind');
  const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8')) as {
    name: string;
    version: string;
    license: string;
  };
  if (manifest.name !== 'uniwind' || !manifest.version.startsWith('1.12.') || manifest.license !== 'MIT') {
    throw new Error('[react-native-boost] The Uniwind integration supports free Uniwind 1.12.x. Pro is not supported.');
  }
  if (!target) throw new Error('[react-native-boost] Uniwind requires a resolved React Native target.');
  const root = path.dirname(packageJson);
  const runtimeRoot = path.resolve(moduleDirectory, '../runtime') + path.sep;
  const reactNativeIndex = path.join(path.dirname(target.packageJson), 'index.js');
  const hooks: Record<string, string> = {
    'react-native-boost/uniwind/useStyle': path.join(root, 'src/components/native/useStyle.ts'),
    'react-native-boost/uniwind/useAccentColor': path.join(root, 'src/components/native/useAccentColor.ts'),
  };
  for (const filename of Object.values(hooks)) {
    if (!fs.existsSync(filename)) throw new Error(`[react-native-boost] Missing Uniwind runtime hook: ${filename}`);
  }
  const delegate = config.resolver?.resolveRequest as
    | NonNullable<import('metro-config').ConfigT['resolver']['resolveRequest']>
    | undefined;
  const resolveRequest: NonNullable<import('metro-config').ConfigT['resolver']['resolveRequest']> = (
    context,
    name,
    platform
  ) => {
    if (platform !== 'web' && context.originModulePath.startsWith(runtimeRoot)) {
      if (name === 'react-native') return context.resolveRequest(context, reactNativeIndex, platform);
      if (hooks[name]) return context.resolveRequest(context, hooks[name], platform);
    }
    return (delegate ?? context.resolveRequest)(context, name, platform);
  };
  return { ...config.resolver, resolveRequest };
}
