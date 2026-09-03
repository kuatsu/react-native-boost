import path from 'node:path';
import { declare } from '@babel/helper-plugin-utils';
import { nativeTextOptimizer } from './optimizers/native-text';
import { nativeImageOptimizer } from './optimizers/native-image';
import type { BabelPluginOptions, HubFile, TargetPlatform } from './types';
import { createLogger } from './utils/logger';
import { nativeViewOptimizer } from './optimizers/native-view';
import { isIgnoredFile } from './utils/common';
import { isUnistylesInstalled } from './utils/unistyles';
import { nativeActivityIndicatorOptimizer } from './optimizers/native-activity-indicator';
import { staticAnimatedOptimizer } from './optimizers/static-animated';
import { validateBabelOptions } from './utils/options';
import PluginError from './utils/plugin-error';
import {
  getReactNativeMinor,
  resolveReactNativeTarget,
  type ReactNativeTargetResolution,
} from './utils/react-native-target';

export type {
  BabelPluginOptions,
  BoostOptions,
  IntegrationState,
  LogLevel,
  OptimizationSetting,
  OptimizationState,
  PluginAssumptions,
  PluginIntegrationOptions,
  PluginOptimizationOptions,
  ReactNativeTargetOption,
} from './types';

const warnings = new Set<string>();

export default declare((api, rawOptions, dirname?: string) => {
  api.assertVersion(7);

  const injectionId = readInternalInjectionId(rawOptions);
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

  const options = validateBabelOptions(stripInternalOptions(rawOptions ?? {}));
  const logger = createLogger(options.logLevel ?? 'info');
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

  return {
    name: 'react-native-boost',
    pre(file) {
      if (injectionId) (file.metadata as Record<string, unknown>).reactNativeBoost = { injectionId };
    },
    visitor: {
      JSXOpeningElement(path) {
        if (isIgnoredFile(path, options.ignores ?? [])) return;
        const file = (path.hub as unknown as { file: HubFile }).file;
        const reactNativeMinor = resolveReactNativeMinor(file);
        const context = { logger, options, platform, unistylesEnabled, reactNativeMinor };
        // The flush is redundant through RN 0.86; RN 0.87 Android can rely on each wrapper to drain a global queue.
        const staticAnimatedDefault =
          reactNativeMinor !== undefined && reactNativeMinor >= 83 && reactNativeMinor <= 86 ? 'on' : 'off';
        if (isOptimizationEnabled(options, 'static-animated', staticAnimatedDefault))
          staticAnimatedOptimizer(path, context);
        if (isOptimizationEnabled(options, 'native-text')) nativeTextOptimizer(path, context);
        if (isOptimizationEnabled(options, 'native-view')) nativeViewOptimizer(path, context);
        if (isOptimizationEnabled(options, 'native-image')) nativeImageOptimizer(path, context);
        if (isOptimizationEnabled(options, 'native-activity-indicator'))
          nativeActivityIndicatorOptimizer(path, context);
      },
    },
  };
});

function isOptimizationEnabled(
  options: BabelPluginOptions,
  name: keyof NonNullable<BabelPluginOptions['optimizations']>,
  defaultState: 'on' | 'off' = 'on'
): boolean {
  const setting = options.optimizations?.[name];
  return ((Array.isArray(setting) ? setting[0] : setting) ?? defaultState) === 'on';
}

function normalizeTargetPlatform(platform: unknown): TargetPlatform | undefined {
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : undefined;
}

function getRequireOrigins(dirname?: string): Array<string | undefined> {
  return [dirname ? path.join(dirname, 'package.json') : undefined, path.join(process.cwd(), 'package.json')];
}

function readInternalInjectionId(rawOptions: unknown): string | undefined {
  const value =
    typeof rawOptions === 'object' && rawOptions !== null && !Array.isArray(rawOptions)
      ? (rawOptions as Record<string, unknown>).__reactNativeBoost
      : undefined;
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length === 0) {
    throw new PluginError('The Metro integration ID is invalid.');
  }
  return value;
}

function stripInternalOptions(rawOptions: unknown): unknown {
  if (typeof rawOptions !== 'object' || rawOptions === null || Array.isArray(rawOptions)) return rawOptions;
  const { __reactNativeBoost, ...options } = rawOptions as Record<string, unknown>;
  void __reactNativeBoost;
  return options;
}

function warnOnce(logger: ReturnType<typeof createLogger>, message: string): void {
  if (warnings.has(message)) return;
  warnings.add(message);
  logger.warning({ message });
}
