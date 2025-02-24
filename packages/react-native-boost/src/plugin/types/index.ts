import { NodePath, types as t } from '@babel/core';

export interface PluginOptions {
  /**
   * Paths to ignore from optimization. Relative to the Babel configuration file.
   */
  ignores?: string[];
  /**
   * Whether or not to log optimized files to the console.
   * @default false
   */
  verbose?: boolean;
  /**
   * The optimizations to apply to the plugin.
   */
  optimizations?: {
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
  };
}

export type Optimizer = (path: NodePath<t.JSXOpeningElement>, log?: (message: string) => void) => void;

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
  /** The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'normalizeAccessibilityProps') */
  nameHint: string;
  /** The current Babel NodePath */
  path: NodePath;
  /**
   * The named import string (e.g. 'normalizeAccessibilityProps'). Ignored if importType is "default".
   */
  importName: string;
  /** The module to import from (e.g. 'react-native-boost') */
  moduleName: string;
  /**
   * Determines which helper to use:
   * - "named" (default) uses addNamed (requires importName)
   * - "default" uses addDefault
   */
  importType?: 'named' | 'default';
}
