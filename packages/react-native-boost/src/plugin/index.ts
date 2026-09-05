import path from 'node:path';
import { traverse, type BabelFile, type PluginObj } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import { nativeTextOptimizer } from './optimizers/native-text';
import { nativeImageOptimizer } from './optimizers/native-image';
import type {
  HubFile,
  OptimizationName,
  Optimizer,
  OptimizerContext,
  OptimizerState,
  PluginOptions,
  TargetPlatform,
} from './types';
import { createLogger } from './utils/logger';
import { nativeViewOptimizer } from './optimizers/native-view';
import { analyzeAncestorModule, createFileIgnoreMatcher } from './utils/common';
import { isUnistylesInstalled } from './utils/unistyles';
import { nativeActivityIndicatorOptimizer } from './optimizers/native-activity-indicator';
import { animatedValueInitializationOptimizer } from './optimizers/animated-value-initialization';
import { animatedWrapperRemovalOptimizer } from './optimizers/animated-wrapper-removal';
import { stylesheetOperationsOptimizer } from './optimizers/stylesheet-operations';
import { platformFoldingOptimizer } from './optimizers/platform-folding';
import { validatePluginOptions } from './utils/options';
import PluginError from './utils/plugin-error';
import { readModuleImports } from './utils/ancestor-snapshot';
import {
  getReactNativeMinor,
  loadReactNativeColorNormalizer,
  resolveReactNativeTarget,
  type ReactNativeTargetResolution,
} from './utils/react-native-target';

export type {
  IntegrationState,
  LogLevel,
  OptimizationSetting,
  OptimizationState,
  PluginAssumptions,
  PluginIntegrationOptions,
  PluginOptimizationOptions,
  PluginOptions,
  ReactNativeTargetOption,
} from './types';

const warnings = new Set<string>();

const ancestorOptimizers: Optimizer[] = [
  animatedWrapperRemovalOptimizer,
  nativeTextOptimizer,
  nativeViewOptimizer,
  nativeImageOptimizer,
  nativeActivityIndicatorOptimizer,
];
const ancestorVisitor = traverse.visitors.merge(ancestorOptimizers.map((optimizer) => optimizer.visitor));
const optimizers: Optimizer[] = [
  platformFoldingOptimizer,
  animatedValueInitializationOptimizer,
  ...ancestorOptimizers,
  stylesheetOperationsOptimizer,
];

export default declare((api, rawOptions, dirname?: string) => {
  api.assertVersion(7);

  const injectionId = readInternalString(rawOptions, '__reactNativeBoost');
  const snapshotPath = readInternalString(rawOptions, '__reactNativeBoostSnapshot');
  const projectRoot = readInternalString(rawOptions, '__reactNativeBoostProjectRoot');
  const callerData = api.caller((caller) =>
    JSON.stringify({
      bundler: (caller as { bundler?: unknown } | undefined)?.bundler,
      platform: (caller as { platform?: unknown } | undefined)?.platform,
    })
  ) as string;
  const caller = JSON.parse(callerData) as { bundler?: unknown; platform?: unknown };
  if (!injectionId && caller.bundler === 'metro') {
    warnOnce(
      createLogger('warn'),
      'React Native Boost 2 must be configured through Metro. Move your options to withBoostConfig in metro.config.js and remove react-native-boost/plugin from babel.config.js.'
    );
    return { name: 'react-native-boost', visitor: {} };
  }

  const options = validatePluginOptions(stripInternalOptions(rawOptions ?? {}));
  const logger = createLogger(options.logLevel ?? 'info');
  const isIgnoredFile = createFileIgnoreMatcher(options.ignores ?? []);
  const platform = normalizeTargetPlatform(caller.platform);
  const configuredTarget = options.target?.reactNative;
  let targetResolution: ReactNativeTargetResolution | undefined = configuredTarget
    ? resolveReactNativeTarget(configuredTarget, getRequireOrigins(dirname))
    : injectionId
      ? { versions: [] }
      : undefined;
  if (targetResolution?.target?.packageJson) {
    (api as typeof api & { addExternalDependency?: (file: string) => void }).addExternalDependency?.(
      targetResolution.target.packageJson
    );
  }

  const unistylesMode = options.integrations?.unistyles ?? 'auto';
  const autoDetectedUnistyles = unistylesMode === 'auto' && isUnistylesInstalled(dirname);
  const unistylesEnabled = unistylesMode === 'on' || autoDetectedUnistyles;

  if (autoDetectedUnistyles) {
    logger.warning({
      message:
        'react-native-unistyles was detected, so Unistyles mode was enabled automatically. Set ' +
        "`integrations: { unistyles: 'on' }` to make this explicit, or set it to `off` to opt out.",
    });
  }

  let colorNormalizerResolved = false;
  let normalizeColor: OptimizerContext['normalizeColor'];

  const resolveReactNativeMinor = (file: HubFile): number | undefined => {
    if (!targetResolution) {
      const fileOptions = file.opts as HubFile['opts'] & { cwd?: string };
      targetResolution = resolveReactNativeTarget(undefined, [
        fileOptions.filename,
        fileOptions.cwd ? path.join(fileOptions.cwd, 'package.json') : undefined,
        ...getRequireOrigins(dirname),
      ]);
      const versions = targetResolution.versions.join(', ');
      if (targetResolution.target && !injectionId) {
        warnOnce(
          logger,
          `Using best-effort React Native ${targetResolution.target.version} detection${versions.includes(',') ? ` from versions ${versions}` : ''}.`
        );
      }
    }

    if (!targetResolution.target && !injectionId) {
      warnOnce(logger, 'React Native could not be detected. Version-dependent optimizations will be skipped.');
    }

    return getReactNativeMinor(targetResolution.target?.version);
  };

  const plugin: PluginObj<OptimizerState> = {
    name: 'react-native-boost',
    pre(file) {
      if (injectionId) (file.metadata as Record<string, unknown>).reactNativeBoost = { injectionId };

      const hubFile = file as unknown as HubFile;
      const ignored = isIgnoredFile(hubFile);
      if (snapshotPath && !ignored) {
        const imports = readModuleImports(snapshotPath, projectRoot, hubFile.opts.filename, platform);
        hubFile.__ancestorImports = imports?.ancestors;
        hubFile.__spreadImports = imports?.spreads;
        hubFile.__ancestorReferences = new Map();
        hubFile.__spreadReferences = new Map();
      }
      const reactNativeMinor = ignored ? undefined : resolveReactNativeMinor(hubFile);
      if (!ignored && !colorNormalizerResolved) {
        normalizeColor = loadReactNativeColorNormalizer(targetResolution?.target?.packageJson);
        colorNormalizerResolved = true;
      }
      this.optimizerContext = { logger, options, platform, unistylesEnabled, reactNativeMinor, normalizeColor };
      this.enabledOptimizations = ignored ? new Set() : getEnabledOptimizations(options, this.optimizerContext);

      configureReactCompilerPass(file, this, snapshotPath !== undefined);
    },
    visitor: traverse.visitors.merge([
      ...optimizers.map((optimizer) => optimizer.visitor),
      {
        Program: {
          enter(path) {
            if (!snapshotPath) return;
            const file = (path.hub as unknown as { file: HubFile }).file;
            file.__ancestorAnalysis ??= analyzeAncestorModule(path);
          },
          exit(path, state) {
            if (!snapshotPath) return;
            const file = (path.hub as unknown as { file: HubFile & { metadata: unknown } }).file;
            const metadata = file.metadata as Record<string, unknown>;
            const boostMetadata = metadata.reactNativeBoost as Record<string, unknown>;
            boostMetadata.analysis = {
              ...file.__ancestorAnalysis,
              ...(state.ancestorSources && {
                sources: Object.fromEntries(
                  [...state.ancestorSources].map(([source, statement]) => [source, statement.source!.value])
                ),
              }),
              references: [...(file.__ancestorReferences?.values() ?? [])],
              spreadReferences: [...(file.__spreadReferences?.values() ?? [])],
            };
          },
        },
      },
    ]),
  };

  return plugin as unknown as PluginObj;
});

function configureReactCompilerPass(file: BabelFile, state: OptimizerState, analyzeExports: boolean): void {
  const hubFile = file as unknown as HubFile;
  const wrapVisitor = file.opts.wrapPluginVisitorMethod;
  file.opts.wrapPluginVisitorMethod = (key, phase, visitor) => {
    const wrapped = wrapVisitor ? wrapVisitor(key, phase, visitor) : visitor;
    if (key !== 'react-forget' || phase !== 'enter') return wrapped;
    return function (this: unknown, path, visitorState) {
      if (path.isProgram()) {
        path.scope.crawl();
        if (analyzeExports) {
          hubFile.__ancestorAnalysis = analyzeAncestorModule(path);
          state.ancestorSources = new Map();
          for (const statement of path.node.body) {
            if ('source' in statement && statement.source) {
              state.ancestorSources.set(statement.source.value, statement);
            }
          }
        }
        // Decide before compiler hoisting hides parents; never retry failed JSX after lowering.
        path.traverse(ancestorVisitor, state);
        for (const optimizer of ancestorOptimizers) state.enabledOptimizations.delete(optimizer.name);
      }
      return wrapped.call(this, path, visitorState);
    };
  };
}

function getEnabledOptimizations(options: PluginOptions, context: OptimizerContext): Set<OptimizationName> {
  return new Set(
    optimizers
      .filter((optimizer) => {
        const defaultState =
          typeof optimizer.defaultState === 'function'
            ? optimizer.defaultState(context)
            : (optimizer.defaultState ?? 'on');
        const setting = options.optimizations?.[optimizer.name];
        return ((Array.isArray(setting) ? setting[0] : setting) ?? defaultState) === 'on';
      })
      .map((optimizer) => optimizer.name)
  );
}

function normalizeTargetPlatform(platform: unknown): TargetPlatform | undefined {
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : undefined;
}

function getRequireOrigins(dirname?: string): Array<string | undefined> {
  return [dirname ? path.join(dirname, 'package.json') : undefined, path.join(process.cwd(), 'package.json')];
}

function readInternalString(rawOptions: unknown, key: string): string | undefined {
  const value =
    typeof rawOptions === 'object' && rawOptions !== null && !Array.isArray(rawOptions)
      ? (rawOptions as Record<string, unknown>)[key]
      : undefined;
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length === 0) throw new PluginError(`The internal ${key} option is invalid.`);
  return value;
}

function stripInternalOptions(rawOptions: unknown): unknown {
  if (typeof rawOptions !== 'object' || rawOptions === null || Array.isArray(rawOptions)) return rawOptions;
  const { __reactNativeBoost, __reactNativeBoostProjectRoot, __reactNativeBoostSnapshot, ...options } =
    rawOptions as Record<string, unknown>;
  void __reactNativeBoost;
  void __reactNativeBoostProjectRoot;
  void __reactNativeBoostSnapshot;
  return options;
}

function warnOnce(logger: ReturnType<typeof createLogger>, message: string): void {
  if (warnings.has(message)) return;
  warnings.add(message);
  logger.warning({ message });
}
