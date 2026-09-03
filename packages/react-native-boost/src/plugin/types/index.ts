import type { NodePath, PluginObj, PluginPass } from '@babel/core';
import { types as t } from '@babel/core';

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
  /** Removes built-in `Animated` wrappers whose props contain no animated values. @default 'on' for RN 0.83–0.86, 'off' otherwise */
  'static-animated'?: OptimizationSetting;
  /** Evaluates static React Native `StyleSheet` operations at build time. @default 'on' */
  'stylesheet-operations'?: OptimizationSetting;
}

export interface PluginAssumptions {
  /**
   * Assume unresolved ancestors and runtime parents do not provide a React Native `Text` context.
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

export interface BoostOptions {
  /** Configures individual optimizations. */
  optimizations?: PluginOptimizationOptions;
  /** Declares project-wide facts that enable additional optimizations. */
  assumptions?: PluginAssumptions;
  /** Configures supported third-party libraries. */
  integrations?: PluginIntegrationOptions;
  /** Paths to ignore from optimization. */
  ignores?: string[];
  /** Controls plugin logging. */
  logLevel?: LogLevel;
}

export type ReactNativeTargetOption =
  | { packageJson: string; version?: never }
  | { packageJson?: never; version: string };

export interface BabelPluginOptions extends BoostOptions {
  /** Supplies the React Native target when automatic detection is unsuitable. */
  target?: {
    reactNative?: ReactNativeTargetOption;
  };
}

export interface MetroPluginOptions extends BoostOptions {
  /** Supplies the React Native package used by a custom Metro resolver. */
  target?: {
    reactNative?: { packageJson: string };
  };
}

export type OptimizationName = keyof PluginOptimizationOptions;

export type TargetPlatform = 'ios' | 'android' | 'web';

export interface OptimizationLogPayload {
  target: string;
  path: NodePath;
}

export interface SkippedOptimizationLogPayload extends OptimizationLogPayload {
  reason: string;
}

export interface WarningLogPayload {
  message: string;
  target?: string;
  path?: NodePath;
}

export interface PluginLogger {
  optimized: (payload: OptimizationLogPayload) => void;
  skipped: (payload: SkippedOptimizationLogPayload) => void;
  forced: (payload: SkippedOptimizationLogPayload) => void;
  warning: (payload: WarningLogPayload) => void;
}

export interface OptimizerContext {
  logger: PluginLogger;
  options: BoostOptions;
  /** Target platform from Babel's caller (e.g. Metro sets `'ios'`/`'android'`). Lets optimizers resolve platform-specific defaults at build time. */
  platform?: TargetPlatform;
  /**
   * Whether "Unistyles mode" is active for this build (resolved once at plugin init from the integration
   * setting and install auto-detection). When `true`, optimizers classify each element's `style` origin and
   * route Unistyles styles to Unistyles' lean host instead of Boost's raw host.
   */
  unistylesEnabled: boolean;
  /** Installed React Native minor version, when it can be resolved at build time. */
  reactNativeMinor?: number;
}

export interface OptimizerState extends PluginPass {
  enabledOptimizations: Set<OptimizationName>;
  optimizerContext: OptimizerContext;
}

export interface Optimizer {
  name: OptimizationName;
  defaultState?: OptimizationState | ((context: OptimizerContext) => OptimizationState);
  visitor: PluginObj<OptimizerState>['visitor'];
}

export type JSXOptimizer = (path: NodePath<t.JSXOpeningElement>, context: OptimizerContext) => void;

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
