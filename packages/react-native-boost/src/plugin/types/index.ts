import { NodePath, types as t } from '@babel/core';

export interface PluginOptimizationOptions {
  /**
   * Whether or not to optimize the Text component.
   * @default true
   */
  text?: boolean;
  /**
   * Whether or not to optimize the View component.
   * @default true
   */
  view?: boolean;
}

export interface PluginOptions {
  /**
   * Paths to ignore from optimization.
   *
   * Patterns are resolved from Babel's current working directory.
   */
  ignores?: string[];
  /**
   * Enables verbose logging
   *
   * When enabled, skipped components and their skip reasons are also logged.
   * @default false
   */
  verbose?: boolean;
  /**
   * Disables all plugin logs.
   * @default false
   */
  silent?: boolean;
  /**
   * The optimizations to apply to the plugin.
   */
  optimizations?: PluginOptimizationOptions;
  /**
   * Opt-in flag that allows View optimization when ancestor components cannot be statically resolved.
   *
   * This may introduce behavioral changes when unresolved ancestors render react-native Text wrappers.
   * @default false
   */
  dangerouslyOptimizeViewWithUnknownAncestors?: boolean;
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
  warning: (payload: WarningLogPayload) => void;
}

export type Optimizer = (path: NodePath<t.JSXOpeningElement>, logger: PluginLogger, options?: PluginOptions) => void;

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
