import { NodePath, types as t } from '@babel/core';

export interface PluginOptimizationOptions {
  /**
   * Whether to optimize the `Text` component.
   * @default true
   */
  text?: boolean;
  /**
   * Whether to optimize the `View` component.
   * @default true
   */
  view?: boolean;
}

export interface PluginOptions {
  /**
   * Paths to ignore from optimization.
   *
   * Patterns are resolved from Babel's current working directory.
   * In nested monorepo apps, parent segments may be needed, for example `../../node_modules/**`.
   * @default []
   */
  ignores?: string[];
  /**
   * Enables verbose logging.
   *
   * With `silent: false`, optimized components are logged by default.
   * When enabled, skipped components and their skip reasons are also logged.
   * @default false
   */
  verbose?: boolean;
  /**
   * Disables all plugin logs.
   *
   * When set to `true`, this overrides `verbose`.
   * @default false
   */
  silent?: boolean;
  /**
   * Toggle individual optimizers.
   *
   * If omitted, all available optimizers are enabled.
   */
  optimizations?: PluginOptimizationOptions;
  /**
   * Enables "Unistyles mode": keep `react-native-unistyles` reactivity working on optimized elements.
   *
   * When enabled, a `Text`/`View` whose `style` resolves to a Unistyles `StyleSheet.create` style is
   * rewritten to Unistyles' own lean host (so its shadow-tree registration survives and theme/breakpoint/
   * variant updates keep working) instead of Boost's raw host; a `Text`/`View` with an unresolvable
   * direct `style` (e.g. `style={props.style}`, a function call) is left untouched, because it could be a
   * Unistyles style arriving from elsewhere; plain/RN styles still optimize to Boost's host as usual.
   *
   * Style origin is resolved within a single file only (cross-file stylesheets count as unresolvable).
   *
   * When omitted, the plugin auto-detects whether `react-native-unistyles` is installed and enables this
   * if so (and logs a one-time hint to set the flag explicitly). Set to `false` to force it off even when
   * Unistyles is installed.
   * @default undefined (auto-detected)
   */
  unistyles?: boolean;
  /**
   * Opt-in flag that allows View optimization when ancestor components cannot be statically resolved.
   *
   * This increases optimization coverage, but may introduce behavioral differences
   * when unresolved ancestors render React Native `Text` wrappers.
   * Prefer targeted ignores first, and enable this only after verifying affected screens.
   * @default false
   */
  dangerouslyOptimizeViewWithUnknownAncestors?: boolean;
  /**
   * Opt-in flag that allows Text optimization when ancestor components cannot be statically resolved.
   *
   * This increases optimization coverage, but may introduce behavioral differences when an unresolved
   * ancestor renders a React Native `Text` wrapper: a nested `Text` must render as the inline
   * `NativeVirtualText` host rather than `NativeText`, and optimizing it would emit the wrong host.
   * Prefer targeted `@boost-force` first, and enable this only after verifying affected screens.
   * @default false
   */
  dangerouslyOptimizeTextWithUnknownAncestors?: boolean;
}

export type OptimizableComponent = 'Text' | 'View';

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
  platform?: string,
  /**
   * Whether "Unistyles mode" is active for this build (resolved once at plugin init from the `unistyles`
   * option + install auto-detection). When `true`, optimizers classify each element's `style` origin and
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
};

/**
 * Options for adding a file import hint.
 */
export interface FileImportOptions {
  file: HubFile;
  /** The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'processAccessibilityProps') */
  nameHint: string;
  /** The current Babel NodePath */
  path: NodePath;
  /**
   * The named import string (e.g. 'processAccessibilityProps'). Ignored if importType is "default".
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
