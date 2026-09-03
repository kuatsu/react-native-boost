import { NodePath, types as t } from '@babel/core';

export type OptimizationState = 'on' | 'off';

export type OptimizationSetting<Options = never> = OptimizationState | [state: OptimizationState, options: Options];

export interface PluginOptimizationOptions {
  /**
   * Replaces the React Native `Text` wrapper with its native host.
   * @default 'on'
   */
  'native-text'?: OptimizationSetting;
  /**
   * Replaces the React Native `View` wrapper with its native host.
   * @default 'on'
   */
  'native-view'?: OptimizationSetting;
  /**
   * Replaces the React Native `Image` wrapper with its native host.
   * @default 'on'
   */
  'native-image'?: OptimizationSetting;
  /**
   * Replaces the React Native `ActivityIndicator` wrapper with its native hosts.
   * @default 'on'
   */
  'native-activity-indicator'?: OptimizationSetting;
}

export interface PluginAssumptions {
  /**
   * Assume unresolved ancestor components do not render a React Native `Text` around their children.
   *
   * This increases optimization coverage, but can emit the wrong native host when the assumption is false.
   * Enable it only after you verify this behavior across the project.
   * @default false
   */
  unknownAncestorsDoNotRenderText?: boolean;
}

export type IntegrationState = 'auto' | 'on' | 'off';

export interface PluginIntegrationOptions {
  /**
   * Keeps `react-native-unistyles` reactivity working on optimized elements.
   *
   * `auto` detects an installed `react-native-unistyles` package and logs a warning when found. Use `on`
   * when the project uses Unistyles, or `off` when the package is installed but not used in transformed code.
   * @default 'auto'
   */
  unistyles?: IntegrationState;
}

export type LogLevel = 'silent' | 'warn' | 'info' | 'debug';

export interface PluginOptions {
  /**
   * Configures individual optimizations. Omitted entries use their documented defaults.
   * @default {}
   */
  optimizations?: PluginOptimizationOptions;
  /**
   * Declares project-wide facts that let Boost apply optimizations it cannot prove safe by static analysis.
   * @default {}
   */
  assumptions?: PluginAssumptions;
  /**
   * Configures behavior for supported third-party libraries.
   * @default {}
   */
  integrations?: PluginIntegrationOptions;
  /**
   * Paths to ignore from optimization.
   *
   * Patterns are resolved from Babel's current working directory.
   * In nested monorepo apps, parent segments may be needed, for example `../../node_modules/**`.
   * @default []
   */
  ignores?: string[];
  /**
   * Controls plugin logging.
   *
   * `warn` logs warnings and forced optimizations. `info` also logs successful optimizations. `debug`
   * also logs skipped optimizations and their reasons. `silent` disables all logs.
   * @default 'info'
   */
  logLevel?: LogLevel;
}

export type OptimizableComponent = 'Text' | 'View' | 'Image' | 'ActivityIndicator';

export type TargetPlatform = 'ios' | 'android' | 'web';

export interface OptimizationLogPayload {
  component: OptimizableComponent;
  path: NodePath<t.JSXOpeningElement>;
}

export interface SkippedOptimizationLogPayload extends OptimizationLogPayload {
  reason: string;
}

export interface WarningLogPayload {
  message: string;
  component?: OptimizableComponent;
  path?: NodePath<t.JSXOpeningElement>;
}

export interface PluginLogger {
  optimized: (payload: OptimizationLogPayload) => void;
  skipped: (payload: SkippedOptimizationLogPayload) => void;
  forced: (payload: SkippedOptimizationLogPayload) => void;
  warning: (payload: WarningLogPayload) => void;
}

export type Optimizer = (
  path: NodePath<t.JSXOpeningElement>,
  logger: PluginLogger,
  options?: PluginOptions,
  /** Target platform from Babel's caller (e.g. Metro sets `'ios'`/`'android'`). Lets optimizers resolve platform-specific defaults at build time. */
  platform?: TargetPlatform,
  /**
   * Whether "Unistyles mode" is active for this build (resolved once at plugin init from the integration
   * setting and install auto-detection). When `true`, optimizers classify each element's `style` origin and
   * route Unistyles styles to Unistyles' lean host instead of Boost's raw host.
   */
  unistylesEnabled?: boolean
) => void;

export type HubFile = t.File & {
  opts: {
    filename: string;
  };
  __hasImports?: Record<string, t.Identifier>;
  __optimized?: boolean;
  __staticImageSourceDeclaration?: t.VariableDeclaration;
};

/**
 * Options for adding a file import hint.
 */
export interface FileImportOptions {
  file: HubFile;
  /** The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'processTextAccessibilityProps') */
  nameHint: string;
  /** The current Babel NodePath */
  path: NodePath;
  /**
   * The named import string (e.g. 'processTextAccessibilityProps'). Ignored if importType is "default".
   */
  importName: string;
  /** The module to import from (e.g. 'react-native-boost/runtime') */
  moduleName: string;
  /**
   * Determines which helper to use:
   * - "named" (default) uses addNamed (requires importName)
   * - "default" uses addDefault
   */
  importType?: 'named' | 'default';
}
