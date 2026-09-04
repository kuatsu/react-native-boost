import type { IntegrationState, LogLevel, OptimizationState, PluginOptions } from '../types';
import PluginError from './plugin-error';

const optionKeys = [
  'crossFileAncestorResolution',
  'optimizations',
  'assumptions',
  'integrations',
  'ignores',
  'logLevel',
  'target',
];
const optimizationKeys = [
  'native-text',
  'native-view',
  'native-image',
  'native-activity-indicator',
  'animated-value-initialization',
  'animated-wrapper-removal',
  'stylesheet-operations',
  'platform-folding',
];
const assumptionKeys = ['unknownAncestorsDoNotRenderText'];
const integrationKeys = ['unistyles'];
const optimizationStates: OptimizationState[] = ['on', 'off'];
const integrationStates: IntegrationState[] = ['auto', 'on', 'off'];
const logLevels: LogLevel[] = ['silent', 'warn', 'info', 'debug'];

const legacyPluginOptions: Record<string, string> = {
  verbose: 'Use `logLevel` instead.',
  silent: 'Use `logLevel` instead.',
  unistyles: 'Use `integrations.unistyles` instead.',
  dangerouslyOptimizeViewWithUnknownAncestors: 'Use `assumptions.unknownAncestorsDoNotRenderText` instead.',
  dangerouslyOptimizeTextWithUnknownAncestors: 'Use `assumptions.unknownAncestorsDoNotRenderText` instead.',
  dangerouslyOptimizeImageWithUnknownAncestors: 'Use `assumptions.unknownAncestorsDoNotRenderText` instead.',
  dangerouslyOptimizeActivityIndicatorWithUnknownAncestors:
    'Use `assumptions.unknownAncestorsDoNotRenderText` instead.',
};

const legacyOptimizations: Record<string, string> = {
  text: 'Use `native-text` instead.',
  view: 'Use `native-view` instead.',
  image: 'Use `native-image` instead.',
  activityIndicator: 'Use `native-activity-indicator` instead.',
};

export function validatePluginOptions(rawOptions: unknown): PluginOptions {
  const options = validateOptions(rawOptions, optionKeys);
  if (options.crossFileAncestorResolution !== undefined && typeof options.crossFileAncestorResolution !== 'boolean') {
    throw new PluginError('`crossFileAncestorResolution` must be a boolean.');
  }
  if (options.target !== undefined) validateTarget(options.target);
  return options as PluginOptions;
}

function validateOptions(rawOptions: unknown, keys: string[]): Record<string, unknown> {
  const options = readObject(rawOptions, 'Plugin options');
  validateKeys(options, keys, 'plugin option', legacyPluginOptions);

  if (options.logLevel !== undefined && !logLevels.some((level) => level === options.logLevel)) {
    throw new PluginError('`logLevel` must be one of `silent`, `warn`, `info`, or `debug`.');
  }

  if (
    options.ignores !== undefined &&
    (!Array.isArray(options.ignores) || options.ignores.some((pattern) => typeof pattern !== 'string'))
  ) {
    throw new PluginError('`ignores` must be an array of strings.');
  }

  if (options.optimizations !== undefined) {
    const optimizations = readObject(options.optimizations, '`optimizations`');
    validateKeys(optimizations, optimizationKeys, 'optimization', legacyOptimizations);
    for (const [name, state] of Object.entries(optimizations)) {
      if (state !== undefined && !optimizationStates.some((candidate) => candidate === state)) {
        throw new PluginError(`Optimization \`${name}\` must be \`on\` or \`off\`.`);
      }
    }
  }

  if (options.assumptions !== undefined) {
    const assumptions = readObject(options.assumptions, '`assumptions`');
    validateKeys(assumptions, assumptionKeys, 'assumption');
    if (
      assumptions.unknownAncestorsDoNotRenderText !== undefined &&
      typeof assumptions.unknownAncestorsDoNotRenderText !== 'boolean'
    ) {
      throw new PluginError('`assumptions.unknownAncestorsDoNotRenderText` must be a boolean.');
    }
  }

  if (options.integrations !== undefined) {
    const integrations = readObject(options.integrations, '`integrations`');
    validateKeys(integrations, integrationKeys, 'integration');
    if (integrations.unistyles !== undefined && !integrationStates.some((state) => state === integrations.unistyles)) {
      throw new PluginError('`integrations.unistyles` must be `auto`, `on`, or `off`.');
    }
  }

  return options;
}

function validateTarget(value: unknown): void {
  const target = readObject(value, '`target`');
  validateKeys(target, ['reactNative'], 'target');
  if (target.reactNative === undefined) return;

  const reactNative = readObject(target.reactNative, '`target.reactNative`');
  validateKeys(reactNative, ['packageJson'], '`target.reactNative` option');
  if (typeof reactNative.packageJson !== 'string' || reactNative.packageJson.length === 0) {
    throw new PluginError('`target.reactNative.packageJson` must be a non-empty string.');
  }
}

function readObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PluginError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function validateKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  label: string,
  replacements: Record<string, string> = {}
): void {
  for (const key of Object.keys(value)) {
    if (allowedKeys.includes(key)) continue;
    const replacement = replacements[key];
    if (replacement) throw new PluginError(`The \`${key}\` ${label} was removed. ${replacement}`);
    throw new PluginError(`Unknown ${label} \`${key}\`.`);
  }
}
